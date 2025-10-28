(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-REVIEW-NOT-FOUND u101)
(define-constant ERR-REVIEW-NOT-VERIFIED u102)
(define-constant ERR-TRAINER-NOT-FOUND u103)
(define-constant ERR-INVALID-WEIGHT u104)
(define-constant ERR-REPUTATION-NOT-INITIALIZED u105)
(define-constant ERR-INVALID-DECAY-RATE u106)
(define-constant ERR-INVALID-BOOST-FACTOR u107)
(define-constant ERR-INVALID-TIME-WEIGHT u108)
(define-constant ERR-INVALID-RATING u109)
(define-constant ERR-UPDATE-NOT-ALLOWED u110)
(define-constant ERR-MAX-TRAINERS-EXCEEDED u111)
(define-constant ERR-INVALID-STATUS u112)
(define-constant ERR-INVALID-LOCATION u113)
(define-constant ERR-INVALID-CURRENCY u114)
(define-constant ERR-INVALID-REVIEW-TYPE u115)
(define-constant ERR-INVALID-VERIFICATION u116)
(define-constant ERR-INVALID-PROOF u117)
(define-constant ERR-INVALID-UPDATE-PARAM u118)
(define-constant ERR-AUTHORITY-NOT-VERIFIED u119)
(define-constant ERR-INVALID-REVIEW-ID u120)

(define-data-var reputation-counter uint u0)
(define-data-var max-trainers uint u5000)
(define-data-var decay-rate uint u90)
(define-data-var boost-verified uint u120)
(define-data-var time-weight-base uint u100)
(define-data-var authority-contract (optional principal) none)

(define-map trainer-reputation
  principal
  {
    total-rating: uint,
    review-count: uint,
    verified-count: uint,
    last-updated: uint,
    reputation-score: uint,
    active: bool
  }
)

(define-map reputation-updates
  principal
  {
    old-score: uint,
    new-score: uint,
    timestamp: uint,
    updater: principal
  }
)

(define-read-only (get-trainer-reputation (trainer principal))
  (map-get? trainer-reputation trainer)
)

(define-read-only (get-reputation-updates (trainer principal))
  (map-get? reputation-updates trainer)
)

(define-read-only (is-trainer-registered (trainer principal))
  (is-some (map-get? trainer-reputation trainer))
)

(define-private (validate-decay-rate (rate uint))
  (if (and (>= rate u50) (<= rate u99))
      (ok true)
      (err ERR-INVALID-DECAY-RATE))
)

(define-private (validate-boost-factor (boost uint))
  (if (and (>= boost u100) (<= boost u200))
      (ok true)
      (err ERR-INVALID-BOOST-FACTOR))
)

(define-private (validate-time-weight (weight uint))
  (if (and (>= weight u50) (<= weight u150))
      (ok true)
      (err ERR-INVALID-TIME-WEIGHT))
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-NOT-AUTHORIZED))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-trainers (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-MAX-TRAINERS-EXCEEDED))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set max-trainers new-max)
    (ok true)
  )
)

(define-public (set-decay-rate (new-rate uint))
  (begin
    (try! (validate-decay-rate new-rate))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set decay-rate new-rate)
    (ok true)
  )
)

(define-public (set-boost-verified (new-boost uint))
  (begin
    (try! (validate-boost-factor new-boost))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set boost-verified new-boost)
    (ok true)
  )
)

(define-public (set-time-weight-base (new-weight uint))
  (begin
    (try! (validate-time-weight new-weight))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set time-weight-base new-weight)
    (ok true)
  )
)

(define-private (calculate-time-decay (last-updated uint))
  (let ((blocks-since (- block-height last-updated)))
    (if (> blocks-since u0)
        (/ (* (var-get decay-rate) (var-get time-weight-base)) (+ u100 blocks-since))
        (var-get time-weight-base))
  )
)

(define-private (calculate-rating-weight (rating uint) (verified bool))
  (let ((base (* rating u20)))
    (if verified
        (* base (var-get boost-verified))
        base)
  )
)

(define-public (update-reputation-from-review (review-id uint))
  (let (
        (review (contract-call? .review-submission get-review review-id))
        (trainer (get trainer review))
        (rating (get rating review))
        (verified (get verification-status review))
        (reputation (map-get? trainer-reputation trainer))
      )
    (asserts! (is-some review) (err ERR-REVIEW-NOT-FOUND))
    (asserts! (get status review) (err ERR-INVALID-STATUS))
    (match reputation
      rep
        (let (
              (old-score (get reputation-score rep))
              (time-weight (calculate-time-decay (get last-updated rep)))
              (rating-weight (calculate-rating-weight rating verified))
              (weighted-score (+ (* old-score time-weight) rating-weight))
              (new-score (/ weighted-score (+ time-weight u20)))
              (new-count (+ (get review-count rep) u1))
              (new-verified (if verified (+ (get verified-count rep) u1) (get verified-count rep)))
            )
          (map-set trainer-reputation trainer
            {
              total-rating: (+ (get total-rating rep) rating),
              review-count: new-count,
              verified-count: new-verified,
              last-updated: block-height,
              reputation-score: new-score,
              active: true
            }
          )
          (map-set reputation-updates trainer
            {
              old-score: old-score,
              new-score: new-score,
              timestamp: block-height,
              updater: tx-sender
            }
          )
          (print { event: "reputation-updated", trainer: trainer, score: new-score })
          (ok new-score)
        )
      (let (
            (current-max (var-get max-trainers))
            (current-count (var-get reputation-counter))
          )
        (asserts! (< current-count current-max) (err ERR-MAX-TRAINERS-EXCEEDED))
        (let ((initial-score (* rating (if verified (var-get boost-verified) u100))))
          (map-set trainer-reputation trainer
            {
              total-rating: rating,
              review-count: u1,
              verified-count: (if verified u1 u0),
              last-updated: block-height,
              reputation-score: initial-score,
              active: true
            }
          )
          (map-set reputation-updates trainer
            {
              old-score: u0,
              new-score: initial-score,
              timestamp: block-height,
              updater: tx-sender
            }
          )
          (var-set reputation-counter (+ current-count u1))
          (print { event: "reputation-initialized", trainer: trainer, score: initial-score })
          (ok initial-score)
        )
      )
    )
  )
)

(define-public (get-trainer-score (trainer principal))
  (match (map-get? trainer-reputation trainer)
    rep
      (let ((time-weight (calculate-time-decay (get last-updated rep))))
        (ok (/ (* (get reputation-score rep) time-weight) u100))
      )
    (err ERR-REPUTATION-NOT-INITIALIZED)
  )
)

(define-public (list-top-trainers (limit uint))
  (let ((all (fold (lambda (acc trainer) (append acc (list trainer))) (map-keys trainer-reputation) (list))))
    (ok (take limit (sort all (lambda (a b)
      (let ((score-a (default-to u0 (get-trainer-score a)))
            (score-b (default-to u0 (get-trainer-score b))))
        (> score-a score-b)
      )
    ))))
  )
)

(define-public (get-trainer-stats (trainer principal))
  (match (map-get? trainer-reputation trainer)
    rep
      (ok {
        average-rating: (if (> (get review-count rep) u0)
                         (/ (get total-rating rep) (get review-count rep))
                         u0),
        review-count: (get review-count rep),
        verified-count: (get verified-count rep),
        reputation-score: (get reputation-score rep),
        active: (get active rep)
      })
    (err ERR-TRAINER-NOT-FOUND)
  )
)