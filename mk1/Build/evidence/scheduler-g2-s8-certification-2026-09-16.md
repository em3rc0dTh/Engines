# G2-S8 Scheduler Multi-Resource Atomicity — Certification Evidence

Date: 2026-09-16

## Scope

G2-S8 extends the canonical Scheduler line on `build/g2-scheduler` with a minimal real multi-resource proof. PR #32 remains draft and unmerged.

Canonical G2-S8 fixture:

```text
SchedulingDemand
  ├── BAY_ACCESS → one concrete BAY
  └── TECHNICIAN → one concrete TECHNICIAN
       ↓
deterministic joint availability
       ↓
sorted capacity locks for every selected resource
       ↓
all-or-nothing ConfirmReservation
       ↓
one scheduler_reservations row
+ N scheduler_reservation_assignments
+ one scheduler_commands result
```

## Candidate head

```text
e68df10cd2d57fa451df60e52f467804318b449f
```

## Candidate CI

```text
Push run  35120323440 — SUCCESS
PR run    35120326801 — SUCCESS
```

Both candidate runs completed all three G2-S8 jobs successfully:

```text
g2-s8-contracts-boundaries       PASS
g2-s8-postgres-multi-resource    PASS
scheduler-g2-s8-seal             PASS
```

The PostgreSQL job re-certified G2-S0 through G2-S7 predecessors and the protected CTA/channel path before sealing G2-S8.

## Candidate artifacts

Push:

```text
scheduler-g2-s8-35120323440
id      10456949538
sha256  b9b212d8c6c9ee6ca360e67d57c59064c57cd4298c37bc35daa2d717ec4343eb

scheduler-g2-s8-seal-35120323440
id      10457169159
sha256  7470dcf34981d294c954ffa3c3200aa06bb1f0fc28c31147a6121bf989a9196d
```

Pull request:

```text
scheduler-g2-s8-35120326801
id      10457069516
sha256  681a147fc98a0d16a03ff74b0e8a27bb6898c8134c81f7fda6753136d9d1da1c

scheduler-g2-s8-seal-35120326801
id      10456308810
sha256  a5e61a37790a805e7551a1dcc00e77c66344cf1c6b91b243c9c5e1f52ce58057
```

## Proven semantics

G2-S8 proves a narrow multi-resource model:

```text
one distinct concrete resource per required capability demand
same canonical query timezone across the selected resource set
capacityUnits consumed on every assignment
deterministic candidate assignment ordering by resourceId
deterministic advisory capacity-lock ordering by resourceId
commit-time revalidation of the complete candidate
reservation + all assignments + command result in one PostgreSQL transaction
same operation/material replays the same reservation
concurrent loser leaves zero reservation / assignment / command effect
```

The one-resource G2-S2/G2-S3 path is preserved rather than replaced. G2-S8 composes the certified availability primitive and introduces a dedicated multi-resource confirmation path.

## Hard-gate findings during candidate construction

The gate rejected two defects before the successful candidate seal.

First candidate head `0bf5f3a172884cd509846cc8da54aabaa6b71128` failed TypeScript because `exactOptionalPropertyTypes` rejected an explicit `limit: undefined`. The contract was corrected so explicit omission is represented consistently.

The next candidate reached the executable PostgreSQL proof and exposed a replay-ordering defect: a successful multi-resource reservation consumed its own candidate slot, and replay incorrectly checked current availability before consulting the durable operation ledger. The implementation was repaired so business+operation replay is resolved first; only genuinely new operations resolve and revalidate current availability.

That repair produced candidate head `e68df10cd2d57fa451df60e52f467804318b449f`, on which both push and PR dedicated gates passed.

## Concurrency proof

The G2-S8 probe creates a joint BAY + TECHNICIAN candidate and races two different operation identities for the same final resource pair/time interval.

Certified candidate invariant:

```text
exactly one confirmation succeeds
exactly one confirmation fails closed
winner persists one reservation and both assignments
loser persists no reservation
loser persists no assignment
loser persists no command result
```

Resource capacity locks are acquired in deterministic lexical resource-id order to avoid per-operation lock-order drift.

## Replay proof

```text
same business + operationId + identical material
→ durable scheduler_commands lookup first
→ same reservation identity
→ replayed = true
→ no second reservation or assignment

same operation identity + changed material
→ inherited idempotency conflict semantics
→ no second mutation
```

## Truth boundary

G2-S8 does **not** certify:

```text
multi-resource hold creation/consumption
solver / optimization / best-fit / scoring / routing
heterogeneous display timezones in one candidate
generalized staff shifts / travel / sequencing
Appointment consuming a multi-resource demand
broad reservation cancellation/completion lifecycle
production readiness / final Scheduler closure
```

G2-S4 holds remain a one-resource contract. G2-S7 Appointment remains a protected predecessor path and continues to use one concrete Scheduler resource.

## Candidate markers

```text
SCHEDULER_G2_S8_CONTRACTS_PASS
SCHEDULER_G2_S8_MULTI_RESOURCE_BOUNDARY_PASS
SCHEDULER_G2_S8_GENERIC_BOUNDARY_PASS
SCHEDULER_G2_S8_HOLD_NONCLAIM_PASS
SCHEDULER_G2_S8_JOINT_AVAILABILITY_PASS
SCHEDULER_G2_S8_ATOMIC_MULTI_RESOURCE_PASS
SCHEDULER_G2_S8_REPLAY_PASS
SCHEDULER_G2_S8_ALL_OR_NOTHING_CONCURRENCY_PASS
SCHEDULER_G2_S8_HOLD_BOUNDARY_PASS
SCHEDULER_G2_S8_MULTI_RESOURCE_PASS
SCHEDULER_G2_S8_PREDECESSOR_REGRESSION_PASS
SCHEDULER_G2_S8_PLATFORM_REGRESSION_PASS
SCHEDULER_G2_S8_CERTIFICATION_PASS
```

## Final-head rule

The candidate proof permits documentation/ledger promotion, but this file, the receipt, design and roadmap mutate the branch SHA. Therefore G2-S8 is not finally sealed until the **same dedicated G2-S8 workflow** passes again for both push and pull-request events on the exact documentation-complete branch head.

Final exact-head run IDs and artifact digests are to be recorded on PR #32 after that seal so evidence metadata does not mutate the sealed branch again.
