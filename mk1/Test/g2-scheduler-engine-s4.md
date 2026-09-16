# G2 Scheduler Engine — S4 Hold Lifecycle + Logical Expiry + Replay

Date: 2026-09-14

## Verdict

```text
G2-S0 Contract + persistence foundation   ✅ CERTIFIED
G2-S1 Resource/capability/schedule mgmt    ✅ CERTIFIED
G2-S2 Deterministic availability           ✅ CERTIFIED
G2-S3 Atomic reservation conflict          ✅ CERTIFIED
G2-S4 Holds + expiry/replay                ✅ CERTIFIED
G2-S5 Multi-business generality            ⏭️ NEXT
G2-S6 Services snapshot integration        OPEN
G2-S7 Appointment integration              OPEN
G2-S8 Multi-resource proof/deferral        OPEN
G2-S9 Final clean Scheduler certification  OPEN
```

G2-S4 certifies a durable one-resource hold lifecycle on the canonical `build/g2-scheduler` line. Hold correctness is derived from persisted PostgreSQL state and an explicit logical `asOf`; it does not depend on process-memory timers or on a housekeeping worker running at an exact instant.

## Certified hold lifecycle

```text
CreateHold
→ ACTIVE persisted hold
→ same operation + same material replays
→ same operation + changed material fails IDEMPOTENCY_MATERIAL_CONFLICT

ReleaseHold
→ RELEASED persisted state
→ replay-safe
→ released capacity becomes available immediately

Logical expiry
→ expiresAt persisted
→ ACTIVE row with expires_at <= asOf is already non-blocking
→ fresh Pool / process re-entry preserves the same truth
→ housekeeping may later project the row to EXPIRED

Held confirmation
→ valid ACTIVE unexpired hold is consumed atomically with reservation
→ hold becomes CONSUMED
→ exactly one reservation persists
→ confirmation replay returns the same reservation
→ expired hold fails with HOLD_EXPIRED and zero reservation/command effect
```

## Persisted-time expiry invariant

The critical expiry proof intentionally checks the state **before** cleanup:

```text
scheduler_holds.status = ACTIVE
expires_at <= asOf
→ availability ignores the hold
→ slot is available
```

The same query is then repeated through a newly created PostgreSQL Pool. This proves correctness is not being supplied by a `setTimeout`, `setInterval`, cron callback, in-memory cache, or process-local timer state.

Only after the logical truth is proven does `expireHoldsHousekeeping(...)` physically update eligible rows to `EXPIRED`.

## Occupancy + buffer truth

A hold persists the occupied interval, including SchedulingDemand buffers. For the certified fixture:

```text
service slot       09:00 → 09:30 local
before buffer      10 min
after buffer        5 min
persisted occupancy 13:50Z → 14:35Z
```

This ensures the same capacity interval is used by availability, hold blocking and reservation confirmation.

## Hold consumption atomicity

`confirmReservationAtomic(...)` accepts a persisted `holdId` in the G2-S4 path and, under the same transactional correctness boundary:

```text
validate operation + immutable demand
load/lock hold
reject wrong business / wrong demand / wrong interval / expired or non-ACTIVE hold
serialize resource capacity
revalidate current Scheduler truth
persist reservation + assignment
transition hold ACTIVE → CONSUMED
persist successful ConfirmReservation command result
COMMIT
```

Any failure rolls back the transaction. An expired-hold fixture proves zero reservation and zero command-ledger side effect.

## Predecessor + platform regressions

The dedicated G2-S4 workflow re-certifies:

```text
G2-S0 persistence foundation
G2-S1 management semantics
G2-S2 deterministic availability
G2-S3 atomic reservation/concurrency invariant
inherited CTA → Temporal orchestration path
provider/vertical isolation
Appointment remains outside Scheduler
```

Required markers:

```text
SCHEDULER_G2_S4_CONTRACTS_PASS
SCHEDULER_G2_S4_GENERIC_BOUNDARY_PASS
SCHEDULER_G2_S4_PERSISTED_TIME_EXPIRY_PASS
SCHEDULER_G2_S4_NO_APPOINTMENT_MIGRATION_PASS
SCHEDULER_G2_S4_PREDECESSOR_REGRESSION_PASS
SCHEDULER_G2_S4_HOLD_LIFECYCLE_PASS
SCHEDULER_G2_S4_PLATFORM_REGRESSION_PASS
SCHEDULER_G2_S4_CERTIFICATION_PASS
```

## Initial executable candidate

The first complete G2-S4 candidate was:

```text
SHA       dbe392314827184cc6494a5c2ac7f67556a0553f
Push run  34903927096  SUCCESS
PR run    34903931553  SUCCESS
```

Both runs completed:

```text
g2-s4-contracts-boundaries       PASS
g2-s4-postgres-hold-lifecycle    PASS
scheduler-g2-s4-seal             PASS
```

### Initial evidence — push

```text
scheduler-g2-s4-34903927096
id      10371822139
sha256  1c89f6b37c83fa58d288b37ecfb849cdbc36353014bf25eb7c165ecff490d5bb

scheduler-g2-s4-seal-34903927096
id      10372350860
sha256  aef00a1cf561ab1027c4f2a2299904f631e0084430e281b04de4fd0412983757
```

### Initial evidence — PR

```text
scheduler-g2-s4-34903931553
id      10372585373
sha256  c8464800d425df2616a855c0674bea7ac044f8fb986a480cc5ad65d16a43d610

scheduler-g2-s4-seal-34903931553
id      10372635160
sha256  49d0f8dd4b8fabf818398d5ce584e730212023a4d90e113bbbb7583e5a665752
```

A later canonical-head regression also re-ran G2-S4 successfully after the G2-S3 gate was made forward-compatible with later hold lifecycle work. These candidate runs establish executable readiness, but the certification policy still requires the same G2-S4 workflow to pass again on the final documentation/ledger branch head.

## Exact-final-head rule

This receipt, the evidence document, roadmap and machine ledger are committed **before** the final seal. Their final commit changes the branch head, so G2-S4 is not considered formally closed until the dedicated G2-S4 workflow passes on that exact final head. The exact-final-head run IDs and artifact digests are recorded in PR #32 after CI completes, avoiding another branch-head-changing documentation commit.

## Truth boundary

G2-S4 does **not** certify general multi-business behavior, runtime Services→SchedulingDemand creation, Appointment→Scheduler migration, multi-resource search/optimization, reservation cancel/complete lifecycle, Integration Engine behavior, or final Scheduler production readiness.

G2-S5 owns general multi-business proof. Appointment migration remains G2-S7.
