# Build — mk0

## Status

**B0–B6 CERTIFIED — ATTACHMENT-FREE MK0 CORE SYSTEM-CERTIFIED**

```text
B0  runtime/repository skeleton                            ✅ CERTIFIED
B1  canonical contracts + versioned RegistrationPolicy    ✅ CERTIFIED
B2  real Temporal runtime/topology + visibility proof     ✅ CERTIFIED
B3  first CLI CTA Adapter                                  ✅ CERTIFIED
B4  Worker + Task Queue + interactive RegisterNewCustomer ✅ CERTIFIED
B5  PostgreSQL duplicate/customer/registration Activities ✅ CERTIFIED
B6  MongoDB mandatory audit + terminal finalization       ✅ CERTIFIED

Integrated attachment-free Golden gate                      ✅ CERTIFIED
B7 AttachmentStore                                          🔒 GATED
Full mk0 Golden certification                               ⏳ REQUIRES B7
```

Approval record for the staged B0–B6 Build:

```text
mk0/Plan/pre-build-approval-2026-08-24.md
```

The original staged authorization deliberately left B7 closed. The integrated core certification does not change that authorization boundary.

## Current certified system shape

```text
CLI CTA                 Postman-compatible HTTP CTA
   \                           /
    \                         /
             CTA Adapter
                 ↓
       canonical start/session
                 ↓
        Temporal Client port
                 ↓
┌──────────────────────────────────────┐
│ REAL TEMPORAL EXECUTION PLANE        │
│                                      │
│ RegisterNewCustomer Workflow         │
│ Task Queue: engines-mk0-registration │
│ Worker / Activities                  │
│ Query: GetRegistrationState          │
│ Update: ProvideCustomerData          │
│ retries / replay / recovery          │
│ durable Event History                │
└──────────────────┬───────────────────┘
                   ↓
          PostgreSQL Activities
          business/session truth
                   ↓
           MongoDB Activities
         mandatory audit evidence
                   ↓
       PostgreSQL finalization
                   ↓
        CREATED | ALREADY_EXISTS
```

The initiating CTA process is not required to remain alive after Workflow acceptance.

A soft duplicate remains at `WAITING_FOR_DUPLICATE_DECISION` rather than being silently merged or rejected as a hard duplicate.

A mandatory MongoDB audit failure cannot be converted into terminal success.

## Integrated Golden release receipt

The attachment-free core is now certified as one system, not only as individually passing Build stages.

```text
Golden Dataset:  mk0.golden.register-customer.v0
Source SHA:      f0896c58d918e8f3971c78867870243e16a8b604
GitHub run ID:   32873848134
Job ID:          97886979323
Artifact ID:     9573135809
Artifact:        mk0-core-golden-release-32873848134
Digest:          sha256:25fea20c892ea7cd758788ac63a53ba9048b8809599f2b972c5ef77942c2b4e8
Verdict:         ATTACHMENT_FREE_CORE_GOLDEN_PASS
```

Durable certification record:

```text
mk0/Build/evidence/mk0-core-golden-release-certification-2026-08-25.md
```

Golden accounting:

```text
GD-001 PASS
GD-002 PASS
GD-003 DEFERRED_B7
GD-004 DEFERRED_B7
GD-005 PASS
GD-006 PASS
GD-007 PASS
GD-008 PASS
GD-009 DEFERRED_B7
GD-010 DEFERRED_B7
GD-011 PASS
GD-012 PASS
GD-013 PASS
GD-014 PASS
GD-015 PASS
GD-016 PASS
GD-017 PASS
GD-018 PASS

14 attachment-free PASS
4 attachment-dependent DEFERRED_B7
18 total accounted for
```

## What the integrated gate newly proved

The core release gate closed several system-level questions that stage-local tests alone could not completely answer.

### Completed-session exact replay

The orchestration port now rejects duplicate Workflow-ID reuse and resolves an existing business-scoped session by querying its immutable initial-start fingerprint.

```text
same business/session identity + same fingerprint
→ same Workflow ID
→ same Run ID
→ no second registration command
→ no second Customer

same business/session identity + different fingerprint
→ SESSION_IDEMPOTENCY_CONFLICT
→ original Workflow remains authoritative
→ no second business effect
```

### Real Postman-compatible proof surface

mk0 now has a framework-free HTTP CTA proof implemented with Node's built-in `node:http` plus an importable Postman collection.

This is a replaceable transport adapter, not a new orchestration authority.

### CTA death / reconnect

The integrated gate started an intent-only registration through HTTP, observed `WAITING_FOR_REQUIRED_DATA`, killed the HTTP CTA process, and then queried/updated the same Workflow from a fresh Temporal client.

```text
accepted Workflow lost = false
Workflow ID changed     = false
Run ID changed          = false
Customer created early  = false
```

### Multi-round interaction

The same Workflow accepted multiple `ProvideCustomerData` Updates and completed only when RegistrationPolicy requirements became satisfied.

MongoDB recorded logically accepted interaction evidence before successful completion.

### Transient PostgreSQL retry

GD-008 deliberately failed the first matching `createCustomer` Activity attempt.

The Worker recorded the injected `POSTGRES_CUSTOMER_STORE_UNAVAILABLE` failure, Temporal retried the Activity, and the Workflow ultimately completed with exactly one Customer.

### Worker death after a real side effect

GD-011 is the strongest attachment-free durability proof.

The gate allowed PostgreSQL to create the Customer, observed:

```text
CUSTOMER_CREATED_PENDING_AUDIT
```

then killed the delayed Worker before mandatory outcome audit completion.

A different Worker process recovered the same Workflow/Run and completed it with the same Customer ID and no duplicate Customer.

```text
Delayed Worker PID:   5689
Recovery Worker PID:  6120
Workflow ID:          register-customer:golden-business:427a35365ca5875145b397e2b7f391ce
Run ID:               01a039d0-cadf-7dc8-bf39-e3703c2c8c86
Final PostgreSQL:     COMPLETED_CREATED
Customer count:       1
```

### Scheduling isolation

`RegisterNewCustomer` remains isolated from scheduling.

```text
Appointment delta            = 0
ResourceReservation delta    = 0
Availability mutation delta  = 0
```

## Certification evidence index

```text
B0 → mk0/Build/evidence/B0-runtime-certification-2026-08-24.md
B1 → mk0/Build/evidence/B1-contracts-policy-certification-2026-08-24.md
B2 → mk0/Build/evidence/B2-temporal-continuity-certification-2026-08-24.md
B3 → mk0/Build/evidence/B3-cli-cta-certification-2026-08-24.md
B4 → mk0/Build/evidence/B4-interactive-registration-certification-2026-08-24.md
B5 → mk0/Build/evidence/B5-postgres-authority-certification-2026-08-25.md
B6 → mk0/Build/evidence/B6-mongo-audit-finalization-certification-2026-08-25.md
Core Golden → mk0/Build/evidence/mk0-core-golden-release-certification-2026-08-25.md
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
HTTP proof adapter:       node:http
```

Dependency resolution is frozen through `mk0/runtime/package-lock.json`, and certification uses `npm ci`.

## B7 remains gated

The integrated attachment-free certification is **not** implicit authorization for AttachmentStore implementation.

Before B7 entry, project authority must freeze at minimum:

```text
AttachmentStore physical technology
synthetic attachment fixture binaries
expected SHA-256 values
size/count limits
stage/resolve/commit contract
TTL / expired-ingress behavior
retry/idempotency behavior
corruption/hash-mismatch behavior
orphan/reconciliation expectations
```

The four attachment-dependent Golden cases remain:

```text
GD-003 one attachment                    DEFERRED_B7
GD-004 multiple attachments              DEFERRED_B7
GD-009 transient AttachmentStore failure DEFERRED_B7
GD-010 integrity mismatch                DEFERRED_B7
```

## Current release interpretation

The repository may now truthfully state:

> **The attachment-free mk0 `RegisterNewCustomer` core is integrated-Golden certified and release-ready as a laboratory core.**

The repository must not yet state:

```text
full mk0 is complete                    NO
attachment-bearing registration works  NO
B7 is authorized                       NO
production deployment is certified     NO
all Engines workflows are implemented  NO
```

## Next transition

```text
ATTACHMENT-FREE CORE
B0–B6 + integrated Golden
           ✅ CERTIFIED
               ↓
PROJECT AUTHORITY B7 DECISION
               ↓
AttachmentStore technology + fixtures + hashes
               ↓
B7 BUILD + GD-003/004/009/010
               ↓
FULL MK0 GOLDEN CERTIFICATION
```

## Frozen core constraints

- all channels converge on one canonical CTA Adapter contract;
- CTA validates structural/session input, not final Customer completeness;
- CTA never writes business persistence directly;
- accepted Workflow progress survives CTA process loss;
- Temporal owns durable orchestration, retries, replay and recovery;
- real Service / Task Queue / Worker / Workflow / Activities are required;
- Workflow code performs no direct DB/file/network side effects;
- registration identity is business-scoped by `(operation, businessSlug, idempotencyKeyHash)`;
- the normalized material initial start is immutable and fingerprinted;
- exact completed-session replay resolves the existing execution;
- conflicting session reuse is typed and creates no second business effect;
- later `ProvideCustomerData` Updates evolve durable Workflow state without changing the initial fingerprint;
- PostgreSQL remains canonical Customer + registration truth;
- MongoDB remains execution/audit context, not shadow Customer truth;
- mandatory audit milestones must exist before successful terminal outcome;
- mandatory-audit exhaustion cannot become false success;
- Worker loss after Customer persistence must not duplicate the Customer;
- hard duplicate resolves the existing Customer;
- soft duplicate remains distinguishable and requires policy resolution;
- `RegisterNewCustomer` creates zero scheduling effects;
- attachment-bearing success remains blocked while B7 is gated.

> **Current status: ATTACHMENT-FREE MK0 CORE = SYSTEM CERTIFIED. B7 = GATED. FULL MK0 = NOT YET COMPLETE.**
