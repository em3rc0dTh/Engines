# Build — MK0

## Final status

**MK0 BUILD OBJECTIVE COMPLETE**

```text
B0–B7 Customer foundation                  ✅ CERTIFIED
Customer Golden effective accounting       ✅ 18 / 18 PASS
Physical Customer Postman laboratory        ✅ 37 / 37 PASS
Observability / Lab Console                 ✅ CERTIFIED
RegisterNewAppointment second specimen      ✅ CERTIFIED
Reusable Child Workflow composition         ✅ PROVEN
Atomic slot-conflict protection             ✅ PROVEN
Production deployment                       ❌ NOT CERTIFIED
```

## Build progression

```text
B0 runtime/repository skeleton
→ B1 canonical contracts / RegistrationPolicy
→ B2 Temporal topology / continuity
→ B3 CLI CTA boundary
→ B4 durable interactive Customer Workflow
→ B5 PostgreSQL authority
→ B6 Mongo mandatory audit / finalization
→ B7 AttachmentStore
→ integrated local Customer laboratory
→ observability / Lab Console
→ second specimen RegisterNewAppointment
→ MK0 closure
```

The B0–B6 stages remain important provenance, but they are not separate pending releases anymore.

## Current executable shape

```text
CTA / Lab Consoles
        ↓
Temporal
  ├── RegisterNewCustomer
  └── RegisterNewAppointment
          └── Child Workflow RegisterNewCustomer when needed
        ↓
Activities
        ↓
PostgreSQL + MongoDB + AttachmentStore
```

## Customer certification

### Integrated attachment-free core

```text
source   f0896c58d918e8f3971c78867870243e16a8b604
run      32873848134
job      97886979323
artifact 9573135809
sha256   25fea20c892ea7cd758788ac63a53ba9048b8809599f2b972c5ef77942c2b4e8
```

Actual case steps: 14/14 attachment-free Golden cases PASS.

### B7 AttachmentStore

```text
source 80a95d0b9715f91879a9e0cbd7230828098ba997
run    32896780937
```

Certified:

```text
GD-003 PASS
GD-004 PASS
GD-009 PASS
GD-010 PASS
```

Truthful effective accounting:

```text
14 core + 4 attachment = 18 / 18 PASS
```

### Physical local Customer laboratory

Receipt:

[`evidence/mk0-full-local-laboratory-certification-2026-08-26.md`](evidence/mk0-full-local-laboratory-certification-2026-08-26.md)

Observed:

```text
37 tests
37 PASS
0 failures
0 errors
```

## Observability build

The laboratory subsequently added:

- read-only cross-store execution trace;
- Customer draft reconstruction from durable evidence;
- interactive Customer Lab Console;
- explicit finalization semantics;
- CTA contact validation before invalid input enters Temporal;
- stable ordered phone-slot semantics;
- CTA startup readiness retry.

These are laboratory/operability capabilities, not new business authorities.

## RegisterNewAppointment build

Second specimen source certified in clean Compose:

```text
70ab427f34bf353a7239f2f87bbe3b4889ec1efd
```

Run:

```text
33014515270
```

Receipt:

[`evidence/mk0-register-new-appointment-certification-2026-08-26.md`](evidence/mk0-register-new-appointment-certification-2026-08-26.md)

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

This proves that a second Workflow can reuse the existing Customer capability, read business catalog/availability truth through Activities and protect final booking atomically.

## Evidence navigation

Canonical evidence index:

[`evidence/README.md`](evidence/README.md)

Historical stage workflow definitions:

[`ci-archive/README.md`](ci-archive/README.md)

The historical stage workflows were moved out of `.github/workflows/` during closure so modern PRs are not judged by obsolete intermediate assumptions.

## Current active CI

The active workflow directory now focuses on current runtime/release gates:

```text
mk0-b7-ci.yml
mk0-b7-compose-certification.yml
mk0-lab-console-trace.yml
mk0-register-new-appointment.yml
mk0-release.yml
```

`mk0-release.yml` is the consolidated closure gate for integration into `main`.

## Physical local profile

```text
Host             Windows + WSL2
Runtime          Linux / Node / TypeScript
Deployment       Docker Compose
Temporal         local Compose service
PostgreSQL       local Compose service
MongoDB          local Compose service
AttachmentStore shared filesystem volume
CTA              localhost:8787
Temporal UI      localhost:8233
Public tunnel    none
Cloud dependency none
```

## Build closure rule

MK0 should no longer absorb unrelated product features.

New Engines work should start a new stage and reuse this certified spine:

```text
Brainstorming
→ Mining Site / Quarries
→ Design
→ Plan
→ predeclared expectations
→ Build
→ Test / Evidence
```

> MK0 is now a reference implementation and certification laboratory, not an indefinitely growing product branch.
