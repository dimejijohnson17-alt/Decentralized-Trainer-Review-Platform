(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-RATING u101)
(define-constant ERR-INVALID-COMMENT u102)
(define-constant ERR-INVALID-BOOKING-HASH u103)
(define-constant ERR-REVIEW-ALREADY-EXISTS u104)
(define-constant ERR-REVIEW-NOT-FOUND u105)
(define-constant ERR-INVALID-TIMESTAMP u106)
(define-constant ERR-AUTHORITY-NOT-VERIFIED u107)
(define-constant ERR-INVALID-REVIEW-ID u108)
(define-constant ERR-SELF-REVIEW-NOT-ALLOWED u109)
(define-constant ERR-INVALID-TRAINER u110)
(define-constant ERR-INVALID-REVIEWER u111)
(define-constant ERR-INVALID-UPDATE-PARAM u112)
(define-constant ERR-UPDATE-NOT-ALLOWED u113)
(define-constant ERR-MAX-REVIEWS-EXCEEDED u114)
(define-constant ERR-INVALID-STATUS u115)
(define-constant ERR-INVALID-VERIFICATION u116)
(define-constant ERR-INVALID-PROOF u117)
(define-constant ERR-INVALID-LOCATION u118)
(define-constant ERR-INVALID-CURRENCY u119)
(define-constant ERR-INVALID-REVIEW-TYPE u120)

(define-data-var review-counter uint u0)
(define-data-var max-reviews uint u10000)
(define-data-var submission-fee uint u100)
(define-data-var authority-contract (optional principal) none)

(define-map reviews
  uint
  {
    trainer: principal,
    reviewer: principal,
    rating: uint,
    comment: (string-utf8 500),
    booking-hash: (buff 32),
    timestamp: uint,
    review-type: (string-utf8 50),
    verification-status: bool,
    location: (string-utf8 100),
    currency: (string-utf8 20),
    status: bool
  }
)

(define-map reviews-by-booking-hash
  (buff 32)
  uint)

(define-map review-updates
  uint
  {
    update-comment: (string-utf8 500),
    update-rating: uint,
    update-timestamp: uint,
    updater: principal
  }
)

(define-read-only (get-review (id uint))
  (map-get? reviews id)
)

(define-read-only (get-review-updates (id uint))
  (map-get? review-updates id)
)

(define-read-only (is-review-registered (booking-hash (buff 32)))
  (is-some (map-get? reviews-by-booking-hash booking-hash))
)

(define-private (validate-rating (rating uint))
  (if (and (>= rating u1) (<= rating u5))
      (ok true)
      (err ERR-INVALID-RATING))
)

(define-private (validate-comment (comment (string-utf8 500)))
  (if (and (> (len comment) u0) (<= (len comment) u500))
      (ok true)
      (err ERR-INVALID-COMMENT))
)

(define-private (validate-booking-hash (hash (buff 32)))
  (if (is-eq (len hash) u32)
      (ok true)
      (err ERR-INVALID-BOOKING-HASH))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-review-type (type (string-utf8 50)))
  (if (or (is-eq type "online") (is-eq type "in-person") (is-eq type "group"))
      (ok true)
      (err ERR-INVALID-REVIEW-TYPE))
)

(define-private (validate-location (loc (string-utf8 100)))
  (if (and (> (len loc) u0) (<= (len loc) u100))
      (ok true)
      (err ERR-INVALID-LOCATION))
)

(define-private (validate-currency (cur (string-utf8 20)))
  (if (or (is-eq cur "STX") (is-eq cur "USD") (is-eq cur "BTC"))
      (ok true)
      (err ERR-INVALID-CURRENCY))
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

(define-public (set-max-reviews (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-MAX-REVIEWS-EXCEEDED))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set max-reviews new-max)
    (ok true)
  )
)

(define-public (set-submission-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set submission-fee new-fee)
    (ok true)
  )
)

(define-public (submit-review
  (trainer principal)
  (rating uint)
  (comment (string-utf8 500))
  (booking-hash (buff 32))
  (review-type (string-utf8 50))
  (location (string-utf8 100))
  (currency (string-utf8 20))
)
  (let (
        (next-id (var-get review-counter))
        (current-max (var-get max-reviews))
        (authority (var-get authority-contract))
        (current-time block-height)
      )
    (asserts! (< next-id current-max) (err ERR-MAX-REVIEWS-EXCEEDED))
    (try! (validate-rating rating))
    (try! (validate-comment comment))
    (try! (validate-booking-hash booking-hash))
    (try! (validate-review-type review-type))
    (try! (validate-location location))
    (try! (validate-currency currency))
    (asserts! (not (is-eq trainer tx-sender)) (err ERR-SELF-REVIEW-NOT-ALLOWED))
    (asserts! (is-none (map-get? reviews-by-booking-hash booking-hash)) (err ERR-REVIEW-ALREADY-EXISTS))
    (let ((authority-recipient (unwrap! authority (err ERR-AUTHORITY-NOT-VERIFIED))))
      (try! (stx-transfer? (var-get submission-fee) tx-sender authority-recipient))
    )
    (map-set reviews next-id
      {
        trainer: trainer,
        reviewer: tx-sender,
        rating: rating,
        comment: comment,
        booking-hash: booking-hash,
        timestamp: current-time,
        review-type: review-type,
        verification-status: false,
        location: location,
        currency: currency,
        status: true
      }
    )
    (map-set reviews-by-booking-hash booking-hash next-id)
    (var-set review-counter (+ next-id u1))
    (print { event: "review-submitted", id: next-id })
    (ok next-id)
  )
)

(define-public (update-review
  (review-id uint)
  (update-rating uint)
  (update-comment (string-utf8 500))
)
  (let ((review (map-get? reviews review-id)))
    (match review
      r
        (begin
          (asserts! (is-eq (get reviewer r) tx-sender) (err ERR-NOT-AUTHORIZED))
          (try! (validate-rating update-rating))
          (try! (validate-comment update-comment))
          (map-set reviews review-id
            {
              trainer: (get trainer r),
              reviewer: (get reviewer r),
              rating: update-rating,
              comment: update-comment,
              booking-hash: (get booking-hash r),
              timestamp: block-height,
              review-type: (get review-type r),
              verification-status: (get verification-status r),
              location: (get location r),
              currency: (get currency r),
              status: (get status r)
            }
          )
          (map-set review-updates review-id
            {
              update-comment: update-comment,
              update-rating: update-rating,
              update-timestamp: block-height,
              updater: tx-sender
            }
          )
          (print { event: "review-updated", id: review-id })
          (ok true)
        )
      (err ERR-REVIEW-NOT-FOUND)
    )
  )
)

(define-public (verify-review (review-id uint))
  (let ((review (map-get? reviews review-id)))
    (match review
      r
        (begin
          (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
          (asserts! (not (get verification-status r)) (err ERR-INVALID-VERIFICATION))
          (map-set reviews review-id
            (merge r { verification-status: true })
          )
          (print { event: "review-verified", id: review-id })
          (ok true)
        )
      (err ERR-REVIEW-NOT-FOUND)
    )
  )
)

(define-public (get-review-count)
  (ok (var-get review-counter))
)

(define-public (check-review-existence (booking-hash (buff 32)))
  (ok (is-review-registered booking-hash))
)

(define-public (list-reviews-by-trainer (trainer principal))
  (filter (lambda (review) (is-eq (get trainer review) trainer)) (map-get? reviews (range 0 (var-get review-counter))))
)