# G2 Scheduler Engine — S1 Resource / Capability / Schedule Management

Date: 2026-09-14

## Verdict

```text
G2-S0 Contract + persistence foundation   ✅ CERTIFIED
G2-S1 Resource/capability/schedule mgmt    ✅ CERTIFIED
G2-S2 Deterministic availability           ⏭️ NEXT
G2-S3 Atomic reservation conflict          OPEN
G2-S4 Holds + expiry/replay                OPEN
G2-S5 Multi-business generality            OPEN
G2-S6 Services snapshot integration        OPEN
G2-S7 Appointment integration              OPEN
G2-S8 Multi-resource proof/deferral        OPEN
G2-S9 Final clean Scheduler certification  OPEN
```

G2-S1 is certified as an independent Scheduler gate. The branch must still pass the same G2-S1 workflow on the exact final documentation/ledger head before any G2-S2 implementation branch is created.

## Certified scope

G2-S1 adds executable, provider-agnostic Scheduler management commands over the G2-S0 persistence foundation:

```text
CreateResource
UpdateResource
SetResourceStatus
SetScheduleTemplate
PutScheduleOverride
DeleteScheduleOverride
```

The management repository applies the business mutation and durable `scheduler_commands` record in one PostgreSQL transaction. Each operation uses a transaction-scoped advisory lock keyed by `businessSlug + operationId`, then checks the durable operation identity before mutation.

## Certified invariants

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

Resource updates replace the canonical capability set transactionally. Schedule-template updates replace weekly windows transactionally. Schedule overrides prove create → update → delete with expected-revision checks and replay-safe operation identity.

## Candidate executable certification

Exact implementation candidate:

```text
branch  build/g2-s1-scheduler-management
head    f46240972177d97d2ab8d2c1c2d2d455ec040b92
push    34900205613  SUCCESS
```

The successful push run proved:

```text
TypeScript                                        PASS
sequential Scheduler ledger policy                PASS
G2-S0 contract predecessor regression             PASS
protected Appointment / Services / CTA tests      PASS
provider-agnostic G2-S1 boundary                  PASS
no premature Appointment → Scheduler integration  PASS
full migration chain                              PASS
G2-S0 PostgreSQL predecessor regression           PASS
resource/capability/schedule management probe     PASS
inherited CTA → Temporal regression               PASS
evidence upload                                   PASS
aggregate G2-S1 seal                              PASS
```

Terminal markers:

```text
SCHEDULER_G2_S1_CONTRACTS_PASS
SCHEDULER_G2_S1_PREDECESSOR_REGRESSION_PASS
SCHEDULER_G2_S1_MANAGEMENT_PASS
SCHEDULER_G2_S1_PLATFORM_REGRESSION_PASS
SCHEDULER_G2_S1_CERTIFICATION_PASS
```

Candidate evidence:

```text
scheduler-g2-s1-34900205613
id      10370806100
sha256  731aaa5e4f08f7b16ea33bd0cd0cf630143eb5530084b44759a40d132e86118f

scheduler-g2-s1-seal-34900205613
id      10370143963
sha256  39976fbc677bcc8b985eae2222ea7675c7b72c03d31e08ce2f2562db41150ae7
```

## Failure history retained

The first G2-S1 candidate was not promoted. Its persistence probe exposed an order-sensitive assertion for capability readback: PostgreSQL canonical read order was `capability_code ASC`, while the expected array was constructed in a different order. The implementation was left unclaimed, the test was corrected to compare the canonical deterministic ordering, and the replacement candidate above was rerun from a clean lab.

This failure is preserved as part of the certification record because the Scheduler gate advances only on executable evidence, not on an assumed implementation state.

## Non-claims

G2-S1 does not certify deterministic availability generation, effective-capacity calculation over candidate windows, stale SlotCandidate revalidation, concurrent last-capacity winner/loser behavior, logical hold expiry, Services runtime demand creation, Appointment migration, or multi-resource search/optimization. Those remain later G2 gates.

## Advancement rule

The machine ledger may expose G2-S2 as `NEXT` only while G2-S0 and G2-S1 form the contiguous certified prefix. No G2-S2 implementation may begin until this exact G2-S1 branch's final head—including this receipt, ledger, design, roadmap, evidence and workflow—is re-certified by the dedicated G2-S1 workflow.
