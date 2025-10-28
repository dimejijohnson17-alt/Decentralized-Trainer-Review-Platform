(define-constant ERR-NOT-AUTHORIZED u200)
(define-constant ERR-INVALID-NAME u201)
(define-constant ERR-INVALID-BIO u202)
(define-constant ERR-INVALID-CERTIFICATIONS u203)
(define-constant ERR-PROFILE-NOT-FOUND u204)
(define-constant ERR-PROFILE-ALREADY-EXISTS u205)
(define-constant ERR-INVALID-LOCATION u206)
(define-constant ERR-INVALID-RATE u207)
(define-constant ERR-INVALID-STATUS u208)
(define-constant ERR-INVALID-UPDATE-PARAM u209)
(define-constant ERR-AUTHORITY-NOT-VERIFIED u210)
(define-constant ERR-INVALID-EXPERIENCE u211)
(define-constant ERR-INVALID-SPECIALTY u212)
(define-constant ERR-INVALID-CURRENCY u213)
(define-constant ERR-INVALID-CONTACT u214)
(define-constant ERR-INVALID-VERIFICATION u215)
(define-constant ERR-MAX-PROFILES-EXCEEDED u216)
(define-constant ERR-INVALID-TIMESTAMP u217)
(define-constant ERR-INVALID-PRINCIPAL u218)
(define-constant ERR-INVALID-IMAGE-HASH u219)

(define-data-var profile-counter uint u0)
(define-data-var max-profiles uint u5000)
(define-data-var creation-fee uint u500)
(define-data-var authority-contract (optional principal) none)

(define-map trainer-profiles
  principal
  {
    name: (string-utf8 100),
    bio: (string-utf8 500),
    certifications: (list 20 (string-utf8 200)),
    experience-years: uint,
    specialty: (string-utf8 100),
    location: (string-utf8 100),
    hourly-rate: uint,
    currency: (string-utf8 20),
    contact: (string-utf8 200),
    image-hash: (buff 32),
    verified: bool,
    status: bool,
    timestamp: uint
  }
)

(define-map profile-updates
  principal
  {
    update-name: (string-utf8 100),
    update-bio: (string-utf8 500),
    update-timestamp: uint,
    updater: principal
  }
)

(define-read-only (get-profile (trainer principal))
  (map-get? trainer-profiles trainer)
)

(define-read-only (get-profile-updates (trainer principal))
  (map-get? profile-updates trainer)
)

(define-read-only (is-profile-registered (trainer principal))
  (is-some (map-get? trainer-profiles trainer))
)

(define-private (validate-name (name (string-utf8 100)))
  (if (and (> (len name) u0) (<= (len name) u100))
      (ok true)
      (err ERR-INVALID-NAME))
)

(define-private (validate-bio (bio (string-utf8 500)))
  (if (<= (len bio) u500)
      (ok true)
      (err ERR-INVALID-BIO))
)

(define-private (validate-certifications (certs (list 20 (string-utf8 200))))
  (if (<= (len certs) u20)
      (ok true)
      (err ERR-INVALID-CERTIFICATIONS))
)

(define-private (validate-experience (years uint))
  (if (<= years u50)
      (ok true)
      (err ERR-INVALID-EXPERIENCE))
)

(define-private (validate-specialty (spec (string-utf8 100)))
  (if (and (> (len spec) u0) (<= (len spec) u100))
      (ok true)
      (err ERR-INVALID-SPECIALTY))
)

(define-private (validate-location (loc (string-utf8 100)))
  (if (and (> (len loc) u0) (<= (len loc) u100))
      (ok true)
      (err ERR-INVALID-LOCATION))
)

(define-private (validate-rate (rate uint))
  (if (<= rate u1000000)
      (ok true)
      (err ERR-INVALID-RATE))
)

(define-private (validate-currency (cur (string-utf8 20)))
  (if (or (is-eq cur "STX") (is-eq cur "USD") (is-eq cur "BTC"))
      (ok true)
      (err ERR-INVALID-CURRENCY))
)

(define-private (validate-contact (contact (string-utf8 200)))
  (if (<= (len contact) u200)
      (ok true)
      (err ERR-INVALID-CONTACT))
)

(define-private (validate-image-hash (hash (buff 32)))
  (if (is-eq (len hash) u32)
      (ok true)
      (err ERR-INVALID-IMAGE-HASH))
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-INVALID-PRINCIPAL))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-profiles (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-MAX-PROFILES-EXCEEDED))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set max-profiles new-max)
    (ok true)
  )
)

(define-public (set-creation-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set creation-fee new-fee)
    (ok true)
  )
)

(define-public (create-profile
  (name (string-utf8 100))
  (bio (string-utf8 500))
  (certifications (list 20 (string-utf8 200)))
  (experience-years uint)
  (specialty (string-utf8 100))
  (location (string-utf8 100))
  (hourly-rate uint)
  (currency (string-utf8 20))
  (contact (string-utf8 200))
  (image-hash (buff 32))
)
  (let (
        (trainer tx-sender)
        (current-max (var-get max-profiles))
        (authority (var-get authority-contract))
      )
    (asserts! (< (var-get profile-counter) current-max) (err ERR-MAX-PROFILES-EXCEEDED))
    (try! (validate-name name))
    (try! (validate-bio bio))
    (try! (validate-certifications certifications))
    (try! (validate-experience experience-years))
    (try! (validate-specialty specialty))
    (try! (validate-location location))
    (try! (validate-rate hourly-rate))
    (try! (validate-currency currency))
    (try! (validate-contact contact))
    (try! (validate-image-hash image-hash))
    (asserts! (is-none (map-get? trainer-profiles trainer)) (err ERR-PROFILE-ALREADY-EXISTS))
    (let ((authority-recipient (unwrap! authority (err ERR-AUTHORITY-NOT-VERIFIED))))
      (try! (stx-transfer? (var-get creation-fee) tx-sender authority-recipient))
    )
    (map-set trainer-profiles trainer
      {
        name: name,
        bio: bio,
        certifications: certifications,
        experience-years: experience-years,
        specialty: specialty,
        location: location,
        hourly-rate: hourly-rate,
        currency: currency,
        contact: contact,
        image-hash: image-hash,
        verified: false,
        status: true,
        timestamp: block-height
      }
    )
    (var-set profile-counter (+ (var-get profile-counter) u1))
    (print { event: "profile-created", trainer: trainer })
    (ok true)
  )
)

(define-public (update-profile
  (name (string-utf8 100))
  (bio (string-utf8 500))
  (specialty (string-utf8 100))
  (location (string-utf8 100))
  (hourly-rate uint)
  (contact (string-utf8 200))
)
  (let ((trainer tx-sender)
        (profile (map-get? trainer-profiles trainer)))
    (match profile
      p
        (begin
          (try! (validate-name name))
          (try! (validate-bio bio))
          (try! (validate-specialty specialty))
          (try! (validate-location location))
          (try! (validate-rate hourly-rate))
          (try! (validate-contact contact))
          (map-set trainer-profiles trainer
            (merge p
              {
                name: name,
                bio: bio,
                specialty: specialty,
                location: location,
                hourly-rate: hourly-rate,
                contact: contact,
                timestamp: block-height
              }
            )
          )
          (map-set profile-updates trainer
            {
              update-name: name,
              update-bio: bio,
              update-timestamp: block-height,
              updater: trainer
            }
          )
          (print { event: "profile-updated", trainer: trainer })
          (ok true)
        )
      (err ERR-PROFILE-NOT-FOUND)
    )
  )
)

(define-public (verify-profile (trainer principal))
  (let ((profile (map-get? trainer-profiles trainer)))
    (match profile
      p
        (begin
          (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
          (asserts! (not (get verified p)) (err ERR-INVALID-VERIFICATION))
          (map-set trainer-profiles trainer
            (merge p { verified: true })
          )
          (print { event: "profile-verified", trainer: trainer })
          (ok true)
        )
      (err ERR-PROFILE-NOT-FOUND)
    )
  )
)

(define-public (get-profile-count)
  (ok (var-get profile-counter))
)

(define-public (check-profile-existence (trainer principal))
  (ok (is-profile-registered trainer))
)