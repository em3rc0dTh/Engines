# G2 Scheduler Engine — S1 Resource / Capability / Schedule Management

Date: 2026-09-14

## Verdict

```text
G2-S0 Contract + persistence foundation   ✅ CERTIFIED
G2-S1 Resource/capability/schedule mgmt    🟡 IMPLEMENTED — CERTIFICATION PENDING
G2-S2 Deterministic availability           OPEN
G2-S3 Atomic reservation conflict          OPEN
G2-S4 Holds + expiry/replay                OPEN
G2-S5 Multi-business generality            OPEN
G2-S6 Services snapshot integration        OPEN
G2-S7 Appointment integration              OPEN
G2-S8 Multi-resource proof/deferral        OPEN
G2-S9 Final clean Scheduler certification  OPEN
```

This receipt is deliberately provisional until the dedicated G2-S1 workflow passes on the implementation candidate, the ledger advances, and the same gate is re-run on the final branch head.

## Implemented scope

G2-S1 adds executable, provider-agnostic Scheduler management commands over the G2-S0 persistence foundation:

```text
CreateResource
UpdateResource
SetResourceStatus
SetScheduleTemplate
PutScheduleOverride
DeleteScheduleOverride
```

The management repository provides atomic mutation + command-ledger persistence in one PostgreSQL transaction. Each business operation obtains a transaction-scoped advisory lock by `businessSlug + operationId`, then checks the durable `scheduler_commands` identity before applying a mutation.

## Intended certification invariants

```text
same operationId + same command material
→ replayed result
→ zero duplicate business mutation

same operationId + different material
→ IDEMPOTENCY_MATERIAL_CONFLICT
→ zero second business mutation

stale expected revision
→ typed revision conflict
→ zero partial mutation

resource/schedule/override business scope
→ cannot mutate a different business row

schedule/override identity
→ cannot silently move between resources
```

Resource updates replace the canonical capability set under the same transaction. Schedule-template updates replace weekly windows transactionally. Schedule overrides support create → update → delete with version checks and durable command identity.

## Non-claims

G2-S1 does not certify deterministic availability generation, capacity subtraction against reservations/holds, stale SlotCandidate revalidation, concurrent last-capacity winner/loser behavior, logical hold expiry, Services runtime demand creation, Appointment migration, or multi-resource search.

## Required terminal marker

The gate is not certified until the dedicated workflow emits:

```text
SCHEDULER_G2_S1_CERTIFICATION_PASS
```
