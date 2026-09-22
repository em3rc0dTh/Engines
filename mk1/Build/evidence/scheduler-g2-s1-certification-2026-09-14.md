# Scheduler G2-S1 Certification Evidence — 2026-09-14

## Gate

```text
G2-S1 — Resource / Capability / Schedule Management
```

## Stack

```text
base branch  build/g2-s0-scheduler-contract-persistence
base seal    G2-S0 CERTIFIED
head branch  build/g2-s1-scheduler-management
```

## Executable scope

The gate implements and exercises:

```text
CreateResource
UpdateResource
SetResourceStatus
SetScheduleTemplate
PutScheduleOverride
DeleteScheduleOverride
```

All successful mutations persist their durable operation identity/material in `scheduler_commands` within the same PostgreSQL transaction as the business mutation.

## Candidate history

The first implementation candidate was **not certified**. The PostgreSQL probe exposed an order-sensitive assertion in capability round-trip verification: canonical repository reads use `capability_code ASC`, while the expected array was constructed in a different order.

No ledger/roadmap advancement was accepted from that failed candidate. The probe was corrected to compare the canonical deterministic order, then the replacement candidate was run from a clean lab.

## Successful implementation candidate

```text
head  f46240972177d97d2ab8d2c1c2d2d455ec040b92
push  34900205613  SUCCESS
```

Jobs:

```text
g2-s1-contracts-boundaries   PASS
g2-s1-postgres-management    PASS
scheduler-g2-s1-seal         PASS
```

Verified behavior:

```text
TypeScript                                        PASS
Scheduler sequential ledger policy                PASS
G2-S0 contract predecessor regression             PASS
protected Appointment / Services / CTA tests      PASS
provider-agnostic management boundary             PASS
no premature Appointment → Scheduler integration  PASS
full PostgreSQL migration chain                   PASS
G2-S0 persistence predecessor regression          PASS
resource create/update                            PASS
capability replacement                            PASS
resource status revision control                  PASS
schedule create/update                            PASS
override create/update/delete                     PASS
same-material operation replay                    PASS
different-material operation rejection            PASS
stale resource revision rejection                 PASS
stale schedule revision rejection                 PASS
cross-business mutation rejection                 PASS
inherited CTA → Temporal regression               PASS
```

Terminal markers:

```text
SCHEDULER_G2_S1_CONTRACTS_PASS
SCHEDULER_G2_S1_PREDECESSOR_REGRESSION_PASS
SCHEDULER_G2_S1_MANAGEMENT_PASS
SCHEDULER_G2_S1_PLATFORM_REGRESSION_PASS
SCHEDULER_G2_S1_CERTIFICATION_PASS
```

Artifacts:

```text
scheduler-g2-s1-34900205613
id      10370806100
sha256  731aaa5e4f08f7b16ea33bd0cd0cf630143eb5530084b44759a40d132e86118f

scheduler-g2-s1-seal-34900205613
id      10370143963
sha256  39976fbc677bcc8b985eae2222ea7675c7b72c03d31e08ce2f2562db41150ae7
```

## Certified invariants

```text
same operation + same canonical material
→ replayed result
→ no duplicate business mutation

same operation + different canonical material
→ IDEMPOTENCY_MATERIAL_CONFLICT
→ no second business mutation

stale expected revision
→ typed revision conflict
→ no partial business mutation

businessSlug scope
→ no cross-business mutation

schedule/override resource identity
→ cannot silently migrate to another resource
```

## Truth boundary / non-claims

G2-S1 does not claim:

```text
deterministic availability generation
effective-capacity calculation across candidate windows
stale SlotCandidate commit-time revalidation
atomic concurrent reservation winner/loser semantics
logical hold expiry/restart correctness
Services runtime SchedulingDemand handoff
Appointment → Scheduler integration
multi-resource search/optimization
```

Those remain G2-S2 through G2-S8 work.

## Final-head rule

This evidence records the successful implementation candidate. After this evidence, the receipt, design, roadmap, ledger and workflow protection are committed, the **same dedicated G2-S1 workflow must pass again on the exact final branch head**. Only that final-head success authorizes creation of the G2-S2 branch. It does not authorize merge.
