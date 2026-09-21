# S0 — MK1 Runtime Promotion Certification

Date: 2026-08-31 (America/Lima)

Status: **PASS — PROMOTED BASELINE CERTIFIED**

## Purpose

S0 establishes a truthful executable starting point for MK1 without modifying or reinterpreting the frozen MK0 runtime.

The certified strategy is not a source rewrite. `mk1/runtime` was created from the exact Git tree object already used by `mk0/runtime`, and the frozen MK0 fixture/Golden dependencies required by that runtime were promoted with exact blob/tree identity.

## Certified source

```text
Branch      build/mk1-s0-runtime-promotion
Source SHA  6dcafa0f5b5704cb9a3a9bcbdaef25fe368006b1
```

## Git identity proof

The certification job asserted:

```text
mk0/runtime tree == mk1/runtime tree
82dcec4a61ea28283537a2993d047b3bd444edef

mk0/golden-dataset/fixtures tree == mk1/golden-dataset/fixtures tree
dfe73f255ec928b53674a20d4dc044e24c7c1f2b

mk0/golden-dataset/register-new-customer-v0.json
== mk1/golden-dataset/register-new-customer-v0.json

mk0/golden-dataset/register-new-appointment-closure-manifest-v0.json
== mk1/golden-dataset/register-new-appointment-closure-manifest-v0.json
```

Job markers:

```text
MK1_RUNTIME_TREE_IDENTITY_PASS 82dcec4a61ea28283537a2993d047b3bd444edef
MK1_FIXTURE_TREE_IDENTITY_PASS dfe73f255ec928b53674a20d4dc044e24c7c1f2b
MK1_GOLDEN_BASELINE_IDENTITY_PASS
```

## GitHub Actions proof

```text
Workflow  mk1 S0 runtime promotion certification
Run       33461008031
Job       99710964036
Result    success
```

Every certification step completed successfully:

```text
Checkout                                      PASS
Promoted tree identity                        PASS
npm ci                                        PASS
TypeScript check                              PASS
Frozen fast regression surface                PASS
Clean Docker Compose laboratory               PASS
CTA health                                    PASS
B7 AttachmentStore runtime certification      PASS
Contact validation boundary                   PASS
Unified trace / explicit finalization         PASS
Phone slot ordering                           PASS
RegisterNewAppointment specimen               PASS
Evidence capture                              PASS
Artifact upload                               PASS
Cleanup                                       PASS
```

## Fast regression accounting

Observed test suites on the promoted runtime:

```text
Customer/contracts          21 / 21 PASS
CLI CTA                      7 /  7 PASS
AttachmentStore             6 /  6 PASS
Lab Console                 2 /  2 PASS
Appointment date contract   6 /  6 PASS
--------------------------------------
Fast tests                  42 / 42 PASS
```

## Clean Compose evidence

The promoted path built and started a clean Compose laboratory containing:

```text
Temporal
Worker
CTA
PostgreSQL
MongoDB
migration container
AttachmentStore volume
```

CTA health returned the two inherited operations:

```text
RegisterNewCustomer
RegisterNewAppointment
```

## Runtime certification markers

### AttachmentStore

```text
GD-003 PASS
GD-004 PASS
GD-009 PASS — transient failure / retry observed
GD-010 PASS — integrity mismatch correctly failed
B7_ATTACHMENT_RUNTIME_4_OF_4_PASS
```

### Customer / trace boundary

```text
TRACE_CONTACT_VALIDATION_PASS
TRACE_EXPLICIT_FINALIZE_PASS
TRACE_ATTACHMENT_PASS
MK0_LAB_TRACE_CERTIFICATION_PASS
TRACE_PHONE_SLOT_ORDER_PASS
```

### Appointment specimen

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

These marker names remain `MK0_*` where they are emitted by the byte-identical inherited runtime scripts. S0 does not rename historical code merely to create a new claim.

## Evidence artifact

```text
Artifact name   mk1-s0-runtime-promotion-33461008031
Artifact ID     9783188036
Size            23267 bytes
SHA-256         69a895416918dfb163be680f55c9a6dae2bda35fa60a6dd5107c93e971045958
```

## Failed exploratory run retained as evidence

The first S0 workflow attempt (`33460866530`) correctly exposed an important relocation dependency: AttachmentStore tests referenced fixtures relative to the runtime's parent project, so moving only the runtime tree caused `ENOENT` under `mk1/golden-dataset/fixtures`.

That was **not** treated as a product regression and was not hidden. The fix promoted the exact frozen MK0 fixture tree rather than modifying the runtime tests or manufacturing new fixtures. A later intermediate run was cancelled by workflow concurrency after the next corrected head was pushed.

## S0 conclusion

**S0 PASS.**

The repository may now truthfully state:

> **MK1 has an executable baseline that is byte-identical to the certified MK0 runtime and its required frozen fixture/Golden inputs, and that baseline independently passes type checking, fast regression tests and the clean Compose Customer/Attachment/Appointment certification surface from the new `mk1/runtime` path.**

S0 certifies only baseline promotion. It does not yet certify new Services Engine behavior.

## Next gate

```text
S1 — Services contracts + persistence migration
```
