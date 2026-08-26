# MK0 Certification Evidence Index

This directory is the canonical human-readable index of MK0 certification receipts.

## Evidence rule

A receipt proves only the source revision and gate it actually executed.

```text
documented != verified
UNKNOWN != PASS
CI green != product-ready unless the gate proves that product claim
```

Documentation-only commits after a runtime receipt must not be presented as if the runtime was executed against those later commits.

## Stage certification history

| Stage | Receipt |
|---|---|
| B0 Runtime skeleton | [`B0-runtime-certification-2026-08-24.md`](B0-runtime-certification-2026-08-24.md) |
| B1 Contracts / RegistrationPolicy | [`B1-contracts-policy-certification-2026-08-24.md`](B1-contracts-policy-certification-2026-08-24.md) |
| B2 Temporal continuity | [`B2-temporal-continuity-certification-2026-08-24.md`](B2-temporal-continuity-certification-2026-08-24.md) |
| B3 CLI CTA | [`B3-cli-cta-certification-2026-08-24.md`](B3-cli-cta-certification-2026-08-24.md) |
| B4 Interactive registration | [`B4-interactive-registration-certification-2026-08-24.md`](B4-interactive-registration-certification-2026-08-24.md) |
| B5 PostgreSQL authority | [`B5-postgres-authority-certification-2026-08-25.md`](B5-postgres-authority-certification-2026-08-25.md) |
| B6 Mongo audit/finalization | [`B6-mongo-audit-finalization-certification-2026-08-25.md`](B6-mongo-audit-finalization-certification-2026-08-25.md) |

Historical B0–B6 GitHub Actions workflow definitions are preserved under [`../ci-archive/`](../ci-archive/) and are no longer active on every modern PR.

## Integrated Customer proof

### Attachment-free integrated core

Receipt:

[`mk0-core-golden-release-certification-2026-08-25.md`](mk0-core-golden-release-certification-2026-08-25.md)

Exact executed source:

```text
f0896c58d918e8f3971c78867870243e16a8b604
```

Run / job / artifact:

```text
run      32873848134
job      97886979323
artifact 9573135809
sha256   25fea20c892ea7cd758788ac63a53ba9048b8809599f2b972c5ef77942c2b4e8
```

Actual case steps: 14/14 attachment-free Golden cases PASS.

### B7 AttachmentStore proof

Exact executed source:

```text
80a95d0b9715f91879a9e0cbd7230828098ba997
```

Successful runtime run:

```text
32896780937
```

Certified attachment cases:

```text
GD-003 PASS
GD-004 PASS
GD-009 PASS
GD-010 PASS
```

Effective Customer Golden accounting:

```text
14 core cases + 4 attachment cases = 18 / 18 PASS
```

This is **effective accounting across certified artifacts**, not a claim that one historical job executed all 18 cases in one run.

## Physical Customer laboratory

Receipt:

[`mk0-full-local-laboratory-certification-2026-08-26.md`](mk0-full-local-laboratory-certification-2026-08-26.md)

Observed Windows + WSL2 + Docker Compose + Postman result:

```text
37 tests
37 PASS
0 failed assertions
0 errors
```

This is the primary physical end-to-end Customer laboratory receipt.

## Observability / Lab Console

The observability branch added:

- read-only unified execution trace;
- durable Customer-draft reconstruction;
- Customer Lab Console;
- explicit interactive finalization;
- pragmatic contact validation before invalid material enters Temporal;
- stable `phone[n]` slot semantics while fingerprint comparison remains order-independent;
- CTA startup health retry.

The relevant runtime behavior is covered by the active `mk0-lab-console-trace` CI and its certification scripts under `mk0/runtime/scripts/`.

## Second specimen — RegisterNewAppointment

Receipt:

[`mk0-register-new-appointment-certification-2026-08-26.md`](mk0-register-new-appointment-certification-2026-08-26.md)

Exact executed runtime source:

```text
70ab427f34bf353a7239f2f87bbe3b4889ec1efd
```

GitHub Actions:

```text
run      33014515270
artifact 9623938890
sha256   768865e38e86d04a761dfd2bb0141f9441c29902144ea5fc1cd1e8391a77e1a2
```

Certified markers:

```text
APPOINTMENT_NEW_CUSTOMER_CHILD_PASS
APPOINTMENT_CATALOG_PASS
APPOINTMENT_PAST_DATE_REJECTED
APPOINTMENT_DATE_AND_SLOTS_PASS
APPOINTMENT_BOOKING_PASS
APPOINTMENT_IDEMPOTENCY_REPLAY_PASS
APPOINTMENT_SLOT_CONFLICT_PASS
MK0_REGISTER_NEW_APPOINTMENT_PASS
```

This proves the second Workflow reuses the Customer capability, reads catalog/availability fixture truth through Activities, requires explicit finalization and prevents double-booking at final persistence.

## Manual Appointment observation

A subsequent local Appointment Lab Console run observed:

- incomplete Customer blocked Service selection;
- new Customer creation;
- Service/Product catalog presentation;
- `ayer` rejection;
- `mañana` normalization;
- invalid slot rejection;
- `READY_TO_FINALIZE` before booking;
- terminal `CREATED` after explicit `finish`.

The automated clean Compose certification above remains the authority for persistence and slot-race claims.

## MK0 verdict

```text
Architecture objective                         COMPLETE
RegisterNewCustomer laboratory                 CERTIFIED
RegisterNewAppointment reuse/composition       CERTIFIED
Production deployment                          NOT CERTIFIED
Broader Engines product                        FUTURE WORK
```
