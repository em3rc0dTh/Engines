# G2 Scheduler Engine — S3 Atomic Reservation + Concurrency Conflict

Date: 2026-09-14

## Verdict

```text
G2-S0 Contract + persistence foundation   ✅ CERTIFIED
G2-S1 Resource/capability/schedule mgmt    ✅ CERTIFIED
G2-S2 Deterministic availability           ✅ CERTIFIED
G2-S3 Atomic reservation conflict          ✅ CERTIFIED
G2-S4 Holds + expiry/replay                ⏭️ NEXT
G2-S5 Multi-business generality            OPEN
G2-S6 Services snapshot integration        OPEN
G2-S7 Appointment integration              OPEN
G2-S8 Multi-resource proof/deferral        OPEN
G2-S9 Final clean Scheduler certification  OPEN
```

G2-S3 certifies the first atomic **single-resource direct candidate confirmation** boundary. The candidate is advisory when shown; confirmation revalidates current Scheduler truth under a resource-scoped PostgreSQL serialization boundary before persistence.

## Certified critical invariant

```text
two concurrent confirmations for the final unit of capacity
→ exactly one success
→ exactly one typed CAPACITY_CONFLICT
→ exactly one scheduler_reservations row
→ exactly one scheduler_reservation_assignments row
→ exactly one successful ConfirmReservation scheduler_commands row
→ loser transaction commits no reservation / assignment / command effect
```

The concurrency fixture executes both confirmations concurrently against the same one-capacity resource and the same previously displayed candidate.

## Atomic confirmation semantics

`confirmReservationAtomic(...)` performs:

```text
validate canonical command + immutable SchedulingDemand
lock durable operation identity
replay prior successful operation when material is identical
reject same operation identity + different material
resolve the advisory candidate to one resource
acquire resource-scoped PostgreSQL advisory transaction lock
lock current resource row FOR UPDATE
re-run deterministic availability against current truth
classify capacity disappearance as CAPACITY_CONFLICT
classify non-capacity stale candidate as SLOT_NO_LONGER_AVAILABLE
persist immutable demand snapshot if new
insert reservation
insert reservation assignment
insert successful command-ledger result
COMMIT
```

Any error rolls the transaction back.

## Commit-time stale-candidate proof

A second fixture first produces a valid G2-S2 candidate, then installs an `UNAVAILABLE` override before confirmation. Confirmation rejects it as:

```text
SLOT_NO_LONGER_AVAILABLE
```

and proves zero persisted reservation, command or demand effect for that failed confirmation.

## Replay/idempotency proof

```text
successful operationId + same material
→ same reservation identity
→ replayed = true
→ no duplicate reservation

successful operationId + changed material
→ IDEMPOTENCY_MATERIAL_CONFLICT
→ no second mutation
```

## Initial executable candidate

```text
SHA       84b8b7f6d46c954681fe185175295527c1b029d3
Push run  34902731449  SUCCESS
PR run    34902734577  SUCCESS
```

Both runs completed:

```text
g2-s3-contracts-boundaries          PASS
g2-s3-postgres-atomic-reservation   PASS
scheduler-g2-s3-seal                PASS
```

Required markers:

```text
SCHEDULER_G2_S3_CONTRACTS_PASS
SCHEDULER_G2_S3_PREDECESSOR_REGRESSION_PASS
SCHEDULER_G2_S3_ATOMIC_RESERVATION_PASS
SCHEDULER_G2_S3_PLATFORM_REGRESSION_PASS
SCHEDULER_G2_S3_CERTIFICATION_PASS
```

## Initial evidence — push

```text
scheduler-g2-s3-34902731449
id      10371059124
sha256  16edbc1948b57b90024c800e3a329458168fb2466418eaeca98ffe93bfbbaadc

scheduler-g2-s3-seal-34902731449
id      10371328508
sha256  25f7ebb43847d07999b084b585ad891a3d8911aa08702071b0030996cf0b3abc
```

## Initial evidence — PR

```text
scheduler-g2-s3-34902734577
id      10370773639
sha256  aeb0923c78c963c861b7d63edcadd9087a9da47ad03400c426c60bfc16024ea9

scheduler-g2-s3-seal-34902734577
id      10371835081
sha256  4c53843427c9f938a929bab7333a073a3a233b721954e0efd0e8a8d254c1da5a
```

The canonical branch must be re-run after this receipt, ledger, design, roadmap and evidence documentation are committed. The exact final branch-head runs replace the initial candidate as the final G2-S3 seal.

## Truth boundary

G2-S3 does **not** certify hold creation/consumption/expiry/restart semantics, reservation cancellation/completion lifecycle, general multi-business behavior, runtime Services→SchedulingDemand creation, Appointment→Scheduler migration, multi-resource search/optimization, or final Scheduler production readiness.

`holdId` consumption is deliberately not implemented by the G2-S3 direct confirmation path. G2-S4 owns hold lifecycle and logical expiry semantics.

Appointment remains on the previously certified pre-Scheduler reservation path during this gate. G2-S3 certification only removes the architectural blocker for a later G2-S7 migration; it does not perform that migration.
