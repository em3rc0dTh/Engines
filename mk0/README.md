# MK0 — Engines Orchestration Laboratory

## Status

**OBJECTIVE COMPLETE — LOCAL LABORATORY CERTIFIED**

MK0 exists to answer one architecture question:

> Can Engines provide a reusable durable orchestration spine that survives process loss, keeps channels replaceable, keeps persistence authorities explicit, and can be reused by more than one business workflow?

The answer is **yes**, proven through two executable specimens.

```text
Specimen 01 — RegisterNewCustomer       ✅ CERTIFIED
Specimen 02 — RegisterNewAppointment    ✅ CERTIFIED
Reusable Temporal spine                 ✅ PROVEN
Child Workflow composition              ✅ PROVEN
PostgreSQL business authority           ✅ PROVEN
MongoDB semantic audit                  ✅ PROVEN
AttachmentStore boundary                ✅ PROVEN
Interactive Lab UX / trace              ✅ PROVEN
Local Windows + WSL2 + Compose          ✅ PROVEN
Production deployment                   ❌ OUTSIDE MK0 CERTIFICATION
```

## Canonical architecture

```text
MANY CHANNELS / LAB CLIENTS
         ↓
     CTA ADAPTER
         ↓
 canonical operation
         ↓
┌───────────────────────────────────────┐
│ TEMPORAL / ENGINES                    │
│                                       │
│ Workflow Library                      │
│ durable execution                     │
│ Query / Update / Child Workflow       │
│ retries / replay / recovery           │
└───────────────────┬───────────────────┘
                    ↓
             ACTIVITIES / PORTS
        ┌───────────┼─────────────┐
        ↓           ↓             ↓
   PostgreSQL     MongoDB    AttachmentStore
   business       semantic   binary/document
   truth          audit      truth
```

The CTA can translate transport semantics but cannot become canonical business authority. Workflow code coordinates side effects but does not directly use persistence/network drivers.

## Specimen 01 — RegisterNewCustomer

`RegisterNewCustomer` established the foundation.

Certified behavior includes:

1. legal intent-only Workflow start;
2. durable `WAITING_FOR_REQUIRED_DATA` interaction;
3. multiple `ProvideCustomerData` Updates on the same Workflow;
4. CTA-side contact syntax validation before invalid values enter Temporal;
5. interactive `EXPLICIT_FINALIZE` laboratory mode;
6. business-scoped session idempotency;
7. exact completed-session replay;
8. PostgreSQL Customer/session truth;
9. hard duplicate reuse and soft duplicate waiting;
10. mandatory MongoDB audit before terminal success;
11. Worker/CTA process-loss recovery;
12. AttachmentStore staging, SHA-256 integrity and retry-safe commit;
13. PostgreSQL attachment references without binary business-table storage;
14. stable ordered multiple-phone drafts while fingerprint comparison stays order-independent;
15. read-only execution trace across Temporal, PostgreSQL, MongoDB and AttachmentStore.

### Customer Golden Dataset

The frozen Customer Golden Dataset contains:

```text
GD-001 … GD-018
18 / 18 PASS
```

Important evidence nuance: the historical attachment-free core job was a 14-case gate. B7 independently certified the four attachment cases. Effective accounting is 18/18; this must not be rewritten as one historical 18-case runtime artifact that never existed.

### Physical manual Customer proof

The Windows/WSL2/Postman laboratory produced:

```text
37 tests
37 PASS
0 failed assertions
0 errors
```

Primary receipt:

[`Build/evidence/mk0-full-local-laboratory-certification-2026-08-26.md`](Build/evidence/mk0-full-local-laboratory-certification-2026-08-26.md)

## Observability / Lab Console

The laboratory added a human-operable execution surface without adding a new authority.

Customer console:

```bash
npm run lab:console
```

It can start/resume sessions, provide multiple updates, inspect durable drafts and render a read-only cross-store execution trace.

The trace is evidence projection only; mutation remains through the existing CTA → Temporal paths.

## Specimen 02 — RegisterNewAppointment

The second specimen demonstrates architectural reuse and composition.

Canonical interaction:

```text
RegisterNewAppointment
        ↓
Customer resolution
  ├─ existing Customer → reuse customerId
  └─ new Customer → Child Workflow RegisterNewCustomer
        ↓
load active Services from PostgreSQL
        ↓
select Service
        ↓
load Products for Service from PostgreSQL
        ↓
select Product
        ↓
normalize/select date
        ↓
load available slots through Activity
        ↓
select slot
        ↓
READY_TO_FINALIZE
        ↓
explicit finish
        ↓
atomic PostgreSQL booking
        ↓
Mongo appointment audit
        ↓
CREATED
```

### Laboratory catalog fixture

```text
Business: golden-business
Service : Car Wash
Products:
  Basic Clean       — 30 min
  Executive Clean   — 30 min
  Salon Clean       — 30 min
Timezone: America/Lima
Resource: default
```

The duration and simplified single-resource model are specimen fixtures, **not** final Scheduler Engine semantics.

### Appointment certification

Clean Compose certification source:

```text
70ab427f34bf353a7239f2f87bbe3b4889ec1efd
```

GitHub Actions run:

```text
33014515270
```

Certified receipts:

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

Artifact:

```text
mk0-register-new-appointment-33014515270
artifact id: 9623938890
sha256: 768865e38e86d04a761dfd2bb0141f9441c29902144ea5fc1cd1e8391a77e1a2
```

Receipt:

[`Build/evidence/mk0-register-new-appointment-certification-2026-08-26.md`](Build/evidence/mk0-register-new-appointment-certification-2026-08-26.md)

### Physical interactive Appointment proof

The manual Lab Console run additionally observed:

- incomplete Customer prevented Service selection;
- new Customer `Eduardo` was created through the Customer child path;
- `Car Wash` and three Products were displayed from the catalog;
- `date ayer` was rejected as `PAST_DATE`;
- `date mañana` normalized to `2026-08-27`;
- invalid `slot 4` was rejected;
- `slot 3` reached `READY_TO_FINALIZE`;
- explicit `finish` completed as `CREATED` with an `apt_...` result.

This manual observation complements, but does not replace, the automated persistence/slot-race certification.

## Persistence authority matrix

| Authority | Owns | Does not own |
|---|---|---|
| Temporal | orchestration state, Event History, retries/replay | canonical Customer/Appointment rows |
| PostgreSQL | Customers, registration commands, catalog, availability fixture rules, appointment commands, Appointments | orchestration history |
| MongoDB | semantic execution/audit (`execution_audit`, `appointment_audit`) | canonical Customer/Appointment truth |
| AttachmentStore | staged/committed binary objects and integrity | Customer/Appointment business truth |
| CTA | transport validation/normalization and Temporal client calls | direct business persistence |

## Documentation layout

```text
mk0/
├── Brainstorming/            problem and architecture framing
├── mining-site/
│   └── quarries/             extracted evidence / design constraints
├── Design/                   normative architecture and specimen designs
├── Plan/                     gates, approvals and closure state
├── golden-dataset/           frozen expectations / transparent closure manifests
├── Build/                    implementation history
│   ├── evidence/             certification receipts
│   └── ci-archive/           historical stage workflow definitions
├── Test/                     test contracts and specimen test notes
└── runtime/                  executable laboratory
```

Canonical documentation progression:

```text
Brainstorming
→ Mining Site / Quarries
→ Design
→ Plan
→ Golden expectations
→ Build
→ Test / Evidence
```

## Active vs historical CI

B0–B6 were stage-certification workflows. Their exact workflow definitions are retained under `Build/ci-archive/` so they remain inspectable without firing on every modern PR.

Current active CI is intentionally focused on the completed runtime surface and release closure.

Historical runtime receipts remain authoritative for the revision they actually executed.

## Frozen invariants carried forward

1. Channels are replaceable adapters.
2. Temporal owns durable orchestration.
3. Workflow definitions are channel-independent.
4. Workflow code performs no direct persistence/network side effects.
5. Side effects happen through Activities/ports.
6. PostgreSQL, MongoDB and AttachmentStore retain separate authorities.
7. Accepted Workflow state survives CTA loss.
8. Worker loss does not redefine Workflow identity.
9. Exact replay cannot create a second business effect.
10. Mandatory audit must exist before success where required.
11. Business input validation belongs at the earliest truthful boundary without breaking Workflow replay semantics.
12. Interactive completeness is not automatically equivalent to human finalization.
13. Availability shown to a user is not itself a reservation; persistence must revalidate capacity atomically.
14. A composed Workflow must reuse existing capabilities instead of duplicating their business authority.

## Important limitation — Scheduler semantics

`RegisterNewAppointment` deliberately uses a minimal local availability fixture (`service_availability_rules` + one `default` resource) to prove orchestration and atomic booking.

It does **not** supersede the future TimeSlots architecture in which real capacity is expected to involve schedule rules/overrides and `ResourceReservation` semantics. The second specimen proves the orchestration shape, not a final Scheduler Engine.

## MK0 closure

Current gate ledger:

[`Plan/mk0-gate-status.md`](Plan/mk0-gate-status.md)

Evidence index:

[`Build/evidence/README.md`](Build/evidence/README.md)

> **MK0 is frozen as the certified architecture laboratory. New product work should build on this spine rather than continue expanding MK0 until it becomes the whole platform.**
