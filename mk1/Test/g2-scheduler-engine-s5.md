# G2 Scheduler Engine — S5 Multi-Business Generality

Date: 2026-09-14

## Verdict

```text
G2-S0 Contract + persistence foundation   ✅ CERTIFIED
G2-S1 Resource/capability/schedule mgmt    ✅ CERTIFIED
G2-S2 Deterministic availability           ✅ CERTIFIED
G2-S3 Atomic reservation conflict          ✅ CERTIFIED
G2-S4 Holds + expiry/replay                ✅ CERTIFIED
G2-S5 Multi-business generality            ✅ CERTIFIED
G2-S6 Services snapshot integration        ⏭️ NEXT
G2-S7 Appointment integration              OPEN
G2-S8 Multi-resource proof/deferral        OPEN
G2-S9 Final clean Scheduler certification  OPEN
```

G2-S5 certifies that the same Scheduler implementation can execute materially different business scheduling fixtures without provider, channel, customer, or product-vertical branches in Scheduler core.

## Certified fixtures

```text
Business A
  slug          g2-s5-business-alpha
  resource kind BAY
  capability    ALPHA_CAPABILITY
  duration      30 min
  buffers       5 / 5 min
  schedule      Monday 08:00–12:00

Business B
  slug          g2-s5-business-beta
  resource kind ROOM
  capability    BETA_CAPABILITY
  duration      45 min
  buffers       0 / 10 min
  schedule      Monday 07:30–15:30
```

The business fixtures intentionally share a resource code and multiple operation IDs while keeping distinct business scope. The proof therefore exercises actual scope boundaries rather than relying on globally different command identities.

## Certified isolation invariant

```text
resources          isolated by business
capabilities       isolated by business
schedule truth     isolated by business
availability       isolated by business
holds              isolated by business
reservations       isolated by business
command idempotency isolated by business
```

A capacity-consuming hold/reservation in Business A does not alter Business B availability for the same wall-clock interval.

## Business-scoped operation identity

The following operation IDs are deliberately reused in both businesses:

```text
shared-create-resource
shared-set-schedule
shared-create-hold
shared-confirm-held
```

Each business obtains its own durable command row/result. Replaying a successful operation within its own business scope remains idempotent, while the same operation ID in the other business remains an independent operation.

## Cross-business failure proof

Executable negative cases prove:

```text
Business B schedule → Business A resource
→ PostgreSQL composite scope FK rejects
→ zero successful command-ledger effect

Business B availability + Business A demand
→ SCHEDULING_DEMAND_INVALID

Business B preferred resource = Business A resource
→ zero candidates

Business B release → Business A hold
→ HOLD_NOT_FOUND
→ Business A hold remains unchanged
```

These failures close without partial cross-business effects.

## Capacity non-bleed proof

```text
Business A final capacity unit → RESERVED
Business A availability at interval → 0
Business B availability at same interval → still 1 candidate

Business B then independently
→ creates hold
→ confirms reservation
→ persists its own reservation identity
```

Each business ends the fixture with exactly one resource, one RESERVED reservation and one CONSUMED hold.

## No vertical/provider branch proof

The dedicated workflow fails if G2-S5 fixture names/capabilities or provider/channel mechanics appear in Scheduler core. Fixture-specific data exists only in the certification script.

This preserves the rule:

```text
business differences = data
not Scheduler runtime branches
```

## Predecessor + platform regressions

The G2-S5 workflow re-certifies:

```text
G2-S0 persistence foundation
G2-S1 management semantics
G2-S2 deterministic availability
G2-S3 atomic reservation/concurrency
G2-S4 hold lifecycle/logical expiry
inherited CTA → Temporal orchestration path
Appointment remains outside Scheduler
```

Required markers:

```text
SCHEDULER_G2_S5_NO_FIXTURE_BRANCH_PASS
SCHEDULER_G2_S5_GENERIC_BOUNDARY_PASS
SCHEDULER_G2_S5_NO_APPOINTMENT_MIGRATION_PASS
SCHEDULER_G2_S5_CONTRACTS_PASS
SCHEDULER_G2_S5_PREDECESSOR_REGRESSION_PASS
SCHEDULER_G2_S5_MULTIBUSINESS_PASS
SCHEDULER_G2_S5_PLATFORM_REGRESSION_PASS
SCHEDULER_G2_S5_CERTIFICATION_PASS
```

## Initial executable candidate

```text
SHA       a8cf52ee7791d42ec22c18561b093e5d676618d2
Push run  34906048077  SUCCESS
PR run    34906054870  SUCCESS
```

Both candidate runs completed:

```text
g2-s5-contracts-boundaries   PASS
g2-s5-postgres-multibusiness PASS
scheduler-g2-s5-seal         PASS
```

### Candidate push evidence

```text
scheduler-g2-s5-34906048077
id      10372965143
sha256  0ffa99ec60084c065df60b1cac2a8806020d29c3a2629ada0d41ef4907fa72b3

scheduler-g2-s5-seal-34906048077
id      10372342938
sha256  e7beb1d9cfc11406b9b2b85ce589dea12274357b039522f68d7d7441e64e2fca
```

### Candidate PR evidence

```text
scheduler-g2-s5-34906054870
id      10372158136
sha256  c575d8dce09740383f6b11f04fa0c79a2789c129c60b321287cd750ec934226a

scheduler-g2-s5-seal-34906054870
id      10372283102
sha256  4ef463f1106b1ec4bc68049d0ce9c887ef3fba1f524aefa0b5b3e16d36c8ef99
```

## Exact-final-head rule

This receipt, the evidence document, frozen design, roadmap, and machine-ledger transition are committed before the final seal. G2-S5 is formally closed only when the dedicated G2-S5 push and PR workflows both succeed on that exact final branch head.

Final exact-head run IDs and artifact digests are recorded in PR #32 after CI completes, so evidence publication does not create another branch head and recursively invalidate the seal.

## Truth boundary

G2-S5 certifies general multi-business isolation/generality of the existing Scheduler semantics. It does **not** certify runtime Services→SchedulingDemand derivation, Appointment→Scheduler migration, multi-resource search/optimization, reservation cancel/complete lifecycle, Integration Engine behavior, or final Scheduler production readiness.

G2-S6 owns the Services snapshot/demand runtime boundary. Appointment migration remains G2-S7.
