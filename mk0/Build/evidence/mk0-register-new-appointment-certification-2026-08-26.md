# RegisterNewAppointment — clean Compose certification

Date: 2026-08-26

Status: **AUTOMATED LAB CERTIFICATION PASS**

This receipt covers the second Engines specimen, `RegisterNewAppointment`, on a clean local-equivalent Docker Compose laboratory.

## Source provenance

Branch:

```text
feat/mk0-register-new-appointment
```

Source branch SHA certified by the PR run:

```text
70ab427f34bf353a7239f2f87bbe3b4889ec1efd
```

GitHub Actions run:

```text
33014515270
```

Workflow:

```text
mk0 RegisterNewAppointment certification
```

Job:

```text
register-new-appointment
```

The pull-request runner checked out merge commit:

```text
fc822f17054efeccb98479cf5035ca0a33f3ebd8
```

against base `feat/mk0-lab-console-trace` at `9a077f0282a7924b97946baca612c453adf2d78d`.

Artifact:

```text
name:   mk0-register-new-appointment-33014515270
id:     9623938890
sha256: 768865e38e86d04a761dfd2bb0141f9441c29902144ea5fc1cd1e8391a77e1a2
```

## Static/contract gates

PASS:

- `npm run check`
- existing RegisterNewCustomer B1 contract tests: 21/21
- RegisterNewAppointment contract tests: 6/6
- Lab Console readiness tests: 2/2

Appointment date contract proved:

- `Friday` and `viernes` resolve equivalently.
- ISO / DD-MM-YYYY / DD/MM/YYYY / English month / Spanish month normalize to one canonical date.
- `yesterday` / `ayer` are recognized and rejected as past.
- `today` / `hoy` and `tomorrow` / `mañana` are recognized relative inputs.
- malformed calendar dates are rejected.

## Clean runtime topology

The gate executed:

```text
Docker Compose
├── PostgreSQL 17.8
├── MongoDB 8.0.29
├── Temporal dev service
├── migrations B5 + B6 + B7 + appointment
├── integrated appointment Worker
└── CTA :8787
```

CTA health advertised:

```json
{
  "ok": true,
  "service": "engines-mk0-cta",
  "temporalAddress": "temporal:7233",
  "operations": ["RegisterNewCustomer", "RegisterNewAppointment"]
}
```

## Executable receipts

### New Customer delegation

```text
APPOINTMENT_NEW_CUSTOMER_CHILD_PASS
```

The appointment was started without a Customer. Name + unique email were provided, then Customer resolution executed. No existing Customer matched, so `RegisterNewAppointment` executed the existing `RegisterNewCustomer` as a Temporal Child Workflow and received a canonical `cus_*` Customer ID.

Certified Customer ID:

```text
cus_2db9ee45-c49c-4844-b243-3dbde9e8e1a8
```

### Service/Product catalog

```text
APPOINTMENT_CATALOG_PASS
```

PostgreSQL catalog read through Temporal Activities returned:

Service:

```text
Car Wash
```

Products:

```text
Basic Clean
Executive Clean
Salon Clean
```

No external backend/service was required for this laboratory proof.

### Invalid past date

```text
APPOINTMENT_PAST_DATE_REJECTED
```

`ayer` was resolved at the CTA boundary and rejected as a past business-local date. It did not advance the durable appointment Workflow into slot selection.

### Spanish weekday + availability

```text
APPOINTMENT_DATE_AND_SLOTS_PASS
```

Input:

```text
viernes
```

Canonical result in this run:

```text
2026-08-28
```

Available fixture slots:

```text
06:00–06:30
06:30–07:00
07:00–07:30
```

Each slot is 30 minutes for this fixture only.

### Explicit persistence

```text
APPOINTMENT_BOOKING_PASS
```

The Workflow remained RUNNING before `FinalizeAppointment`. After explicit finalization, PostgreSQL atomically persisted:

```text
appointmentId:   apt_386efbab-ddbd-4865-815b-b72c1777a245
customerId:      cus_2db9ee45-c49c-4844-b243-3dbde9e8e1a8
serviceId:       svc_car_wash
productId:       prd_car_wash_basic
date:            2026-08-28
slot:            06:30–07:00
```

### Idempotency replay

```text
APPOINTMENT_IDEMPOTENCY_REPLAY_PASS
```

Replaying the same business-scoped appointment idempotency identity returned the same Workflow and Run rather than creating another execution.

### Slot race / double-booking protection

```text
APPOINTMENT_SLOT_CONFLICT_PASS
```

Two independent appointment Workflows both observed `07:00` as available before either had persisted it. Both selected that same slot.

The first Workflow finalized and won the atomic PostgreSQL reservation.

The second Workflow finalized afterward and **did not persist a second appointment**. It returned to `WAITING_FOR_SLOT` with refreshed availability.

Winning Workflow:

```text
register-appointment:golden-business:9082681a118e910d0971d28f02d8b2d6
```

Losing Workflow:

```text
register-appointment:golden-business:5e96d50ec0f3f45f032fa29955b7dd0a
```

Remaining slot reported to the losing Workflow:

```text
06:00
```

The already-booked `06:30` slot from the first happy-path appointment and the newly won `07:00` race slot were both absent.

## Final automated verdict

```text
MK0_REGISTER_NEW_APPOINTMENT_PASS
```

This means the current automated laboratory proves:

```text
intent-only appointment start
→ Customer resolution
→ RegisterNewCustomer Child Workflow when necessary
→ Service catalog Activity
→ Service selection
→ Product catalog Activity
→ Product selection
→ human date normalization
→ past-date rejection
→ availability Activity
→ slot selection
→ explicit finalization
→ atomic appointment persistence
→ idempotency replay
→ slot-race protection
```

## What this does not prove

This receipt does **not** certify:

- production deployment;
- arbitrary natural-language date interpretation;
- generic Scheduler Engine;
- staff/resource assignment beyond the single `default` lab resource;
- capacity greater than 1;
- recurring/reschedule/cancel workflows;
- payment/pricing behavior;
- external service integrations;
- physical Windows/WSL operator execution of the new appointment console.

The next physical gate is the user's WSL2 run through `npm run lab:appointment`.
