# Build — mk0

## Status

**AUTHORIZED — STAGED B0–B6**

Approval record:

```text
mk0/Plan/pre-build-approval-2026-08-24.md
```

Current Build position:

```text
B0  runtime/repository skeleton                         ✅ CERTIFIED
B1  canonical contracts + versioned RegistrationPolicy ✅ CERTIFIED
B2  real Temporal runtime/topology + visibility proof  ✅ CERTIFIED
B3  first CLI CTA Adapter                              ✅ CERTIFIED
B4  Worker + Task Queue + interactive RegisterNewCustomer ✅ CERTIFIED
B5  PostgreSQL duplicate/customer/registration Activities ← ACTIVE
B6  MongoDB mandatory interaction/audit Activities
B7  AttachmentStore                                    🔒 GATED
```

Certification evidence:

```text
B0 → mk0/Build/evidence/B0-runtime-certification-2026-08-24.md
B1 → mk0/Build/evidence/B1-contracts-policy-certification-2026-08-24.md
B2 → mk0/Build/evidence/B2-temporal-continuity-certification-2026-08-24.md
B3 → mk0/Build/evidence/B3-cli-cta-certification-2026-08-24.md
B4 → mk0/Build/evidence/B4-interactive-registration-certification-2026-08-24.md
```

`B7 AttachmentStore` remains explicitly gated until attachment technology + synthetic fixtures + expected SHA-256 values are frozen.

No application/web framework is selected or required for mk0.

## Certified execution chain so far

```text
CLI CTA
  ↓ canonical B1 envelope
Temporal Client port
  ↓
RegisterNewCustomer Workflow
  ↓
RegistrationPolicy
  ↓
WAITING_FOR_REQUIRED_DATA
  ↓ Query / Update / Worker replacement / reconnect
REQUIRED_DATA_COMPLETE
  ↓
B5 PostgreSQL Activities ← ACTIVE
```

## Certified runtime baseline

```text
Language/runtime:         TypeScript / Node.js 20+
Certified Node runtime:   v24.19.0
Temporal TypeScript SDK:  1.22.0
Temporal CLI:             1.8.1
Temporal Server observed: 1.31.2
Temporal Web UI observed: 2.50.1
Temporal endpoint:        localhost:7233
Temporal Web UI:          localhost:8233
Namespace:                default
Task Queue:               engines-mk0-registration
PostgreSQL observed:      17.8
MongoDB observed:         8.0.29
Web/application framework: none
```

Dependency resolution is frozen through the committed `mk0/runtime/package-lock.json`, and certification uses `npm ci`.

## B1–B3 certified boundaries

B1 owns pure contracts/policy semantics. B2 proves the Temporal execution plane survives Worker loss. B3 owns the first replaceable transport boundary and produces a canonical envelope without direct Temporal/persistence authority.

## B4 certified interactive Workflow

B4 introduced the real `RegisterNewCustomer` Workflow and proved:

```text
CLI → Temporal start                        PASS
intent-only start → WAITING                 PASS
GetRegistrationState Query                  PASS
ProvideCustomerData Update                  PASS
policy-driven missing fields                PASS
first Customer patch survives SIGKILL       PASS
Worker #2 replays same Workflow/Run         PASS
inputId dedup survives Worker replacement   PASS
second Update → REQUIRED_DATA_COMPLETE      PASS
reconnect Query returns same durable state  PASS
Update Event History captured               PASS
```

Certified B4 execution:

```text
Workflow ID: register-customer:golden-business:9cb9fc4270d313cc171c8c03dbeffdac
Run ID:      01a03720-d905-73ec-965f-2e8e2756e1f1
Worker #1:   PID 2378 → SIGKILL
Worker #2:   PID 2619
```

At `REQUIRED_DATA_COMPLETE`:

```text
workflowStatus = RUNNING
missingFields  = []
created        = absent
result         = absent
```

This is intentional. The B4 laboratory Workflow was terminated only after evidence capture because persistence authority was not yet implemented. B4 did not claim `CREATED` or `ALREADY_EXISTS`.

## B5 active target — PostgreSQL authority + Activities

B5 introduces the first real **business persistence authority**.

PostgreSQL must own:

```text
canonical Customer records
registration/idempotency reservation truth
initial-start fingerprint conflict detection
hard-unique duplicate identity
soft-match candidate lookup data required by the Golden policy
transactional create/finalize outcome
```

B5 may implement:

```text
versioned SQL migrations/schema
PostgreSQL connection/repository boundary
registration command/session reservation Activity
business-scoped idempotency key hash
initial-start fingerprint hash
exact replay vs SESSION_IDEMPOTENCY_CONFLICT classification
hard-unique Customer lookup
soft-match Customer candidate lookup
idempotent Customer create Activity
registration result/finalization Activity
Temporal Activity proxies + retry policy
Workflow transition after REQUIRED_DATA_COMPLETE into duplicate/persistence phases
```

B5 must preserve duplicate semantics:

```text
HARD_UNIQUE match
  → no second Customer
  → ALREADY_EXISTS candidate outcome

SOFT_MATCH only
  → do not silently merge or create
  → surface WAITING_FOR_DUPLICATE_DECISION

no duplicate
  → persist canonical Customer exactly once
```

However **B5 alone still must not report final success externally** if the mandatory B6 MongoDB success-gating audit milestones have not yet been written. PostgreSQL may create/reserve canonical business truth in B5, but final `CREATED` / `ALREADY_EXISTS` success publication remains gated by B6.

B5 must not:

```text
write MongoDB audit/context directly from Workflow code
turn MongoDB into Customer authority
implement attachments
create Appointment/ResourceReservation
put SQL/network access inside Workflow code
let CTA write PostgreSQL
introduce Agent/Hermes
```

B5 certification must prove at minimum:

```text
real PostgreSQL schema migration                   PASS
Activity-only database access                     PASS
business-scoped registration reservation          PASS
same start replay is idempotent                    PASS
same scoped key + different fingerprint conflicts PASS
hard duplicate does not create second Customer    PASS
soft duplicate is surfaced, not silently resolved PASS
new Customer is created once                      PASS
Activity retry/re-execution remains idempotent    PASS
Workflow reaches PostgreSQL-backed pre-audit state PASS
no scheduling side effects                        PASS
no false final success before B6                  PASS
```

## Non-negotiable Temporal rule

mk0 must not use:

- an in-process fake Workflow engine;
- a hand-written state-machine loop presented as Temporal;
- database flags as a substitute for Temporal Workflow state;
- a CTA process that must remain alive for Workflow progress;
- a reduced custom orchestrator that bypasses Task Queue/Worker semantics.

## Frozen constraints

- no web framework dependency in the architecture;
- all channels converge on one CTA Adapter contract;
- CTA validates structural/session input before Temporal start, not final Customer completeness;
- CTA/adapter never writes business persistence directly;
- Temporal owns durable sequencing/retries/recovery;
- real Task Queue/Worker semantics are required;
- Workflow code calls no DB/file/network driver directly;
- Activities are retry-safe/idempotent;
- registration session identity is business-scoped by `(operation, businessSlug, idempotencyKeyHash)`;
- normalized material initial-start input is fingerprinted for exact replay/conflict detection;
- later `ProvideCustomerData` Updates evolve Workflow state without rewriting the initial-start fingerprint;
- PostgreSQL is canonical Customer + registration/idempotency truth;
- MongoDB stores execution/audit/workflow context, not a shadow Customer truth;
- required MongoDB success-gating milestones must exist before `CREATED` or `ALREADY_EXISTS` is reported as successful;
- exhausted mandatory-audit failure cannot be converted into success;
- attachments use a separate persistence contract and remain gated in B7;
- CTA disconnect must not stop an accepted Workflow;
- Worker restart must not lose accepted Workflow progress;
- CTA reconnect/query must resolve the same durable outcome;
- RegisterNewCustomer creates zero scheduling side effects.

> **B0–B4 = CERTIFIED. B5 = ACTIVE.**
