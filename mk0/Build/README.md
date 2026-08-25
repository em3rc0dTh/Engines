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
B3  first CLI CTA Adapter                               ✅ CERTIFIED
B4  Worker + Task Queue + interactive RegisterNewCustomer ✅ CERTIFIED
B5  PostgreSQL duplicate/customer/registration Activities ✅ CERTIFIED
B6  MongoDB mandatory interaction/audit Activities     ← ACTIVE
B7  AttachmentStore                                    🔒 GATED
```

Certification evidence:

```text
B0 → mk0/Build/evidence/B0-runtime-certification-2026-08-24.md
B1 → mk0/Build/evidence/B1-contracts-policy-certification-2026-08-24.md
B2 → mk0/Build/evidence/B2-temporal-continuity-certification-2026-08-24.md
B3 → mk0/Build/evidence/B3-cli-cta-certification-2026-08-24.md
B4 → mk0/Build/evidence/B4-interactive-registration-certification-2026-08-24.md
B5 → mk0/Build/evidence/B5-postgres-authority-certification-2026-08-25.md
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
PostgreSQL Activities
  ├── registration/idempotency reservation
  ├── initial-start fingerprint authority
  ├── hard/soft duplicate lookup
  └── canonical Customer persistence
  ↓
PERSISTING_AUDIT_CONTEXT
  ↓
B6 MongoDB mandatory audit ← ACTIVE
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

B4 intentionally stopped before persistence success.

## B5 certified PostgreSQL authority

B5 introduced the first real application business persistence authority and certified it against GitHub Actions run `32859253361`.

Final certified source receipt:

```text
Source SHA: 9a8caf10448720f20d4597b31c7dcf342724c926
Artifact:   mk0-b5-postgres-authority-32859253361
Digest:     sha256:abeb00d08ae11033ccbc2112c822c55c95e34c75d8a18c2c8257d6c3bdd1413f
```

Certified B5 assertions:

```text
migrationIdempotent                         PASS
relationalCustomerSchema                    PASS
rawIdempotencyKeyNotPersisted               PASS
exactRegistrationReplay                     PASS
fingerprintConflict                         PASS
businessScopedKeyIsolation                  PASS
repeatedCustomerCreateIdempotent            PASS
concurrentHardUniqueSingleCustomer          PASS
initialFingerprintImmutableAcrossUpdates    PASS
newCustomerCreatedOnce                      PASS
hardDuplicateNoSecondCustomer               PASS
softDuplicateRequiresDecision               PASS
activityOnlyDatabaseAccess                  PASS
noFinalSuccessBeforeB6                      PASS
```

### New Customer path

Certified Golden execution reached PostgreSQL-backed pre-audit state:

```text
Workflow ID: register-customer:golden-business:05aec8fb7529f80ddfa057b7aa3c360b
Run ID:      01a0394f-24ad-7a69-a66b-afcb394779ac
Customer ID: cus_8b8a95cb-f6fb-4e55-bdd8-1c8c47961cc7
Phase:       PERSISTING_AUDIT_CONTEXT
PostgreSQL:  CUSTOMER_CREATED_PENDING_AUDIT
```

Normalized PostgreSQL evidence included:

```text
name     = Primary Customer
email    = primary@example.test
document = DNI / PE / 12345678
```

`result` and `created` remained absent. This is the required B5 boundary, not an incomplete implementation.

### Hard duplicate path

A second registration with the same Golden hard-unique document resolved the same Customer ID and produced:

```text
PostgreSQL status = EXISTING_CUSTOMER_PENDING_AUDIT
Workflow phase    = PERSISTING_AUDIT_CONTEXT
second Customer   = 0
```

### Soft duplicate path

A soft-match-only registration produced:

```text
Workflow phase   = WAITING_FOR_DUPLICATE_DECISION
nextAction       = RESOLVE_DUPLICATE
PostgreSQL state = SOFT_DUPLICATE_PENDING_DECISION
```

No silent merge or automatic Customer creation occurred.

### Policy-driven hard uniqueness

B5 does not install a universal SQL `UNIQUE(document)` constraint. When `RegistrationPolicy` marks the document selector as `HARD_UNIQUE`, Customer creation uses a transaction-scoped PostgreSQL advisory lock derived from stable SHA-256 ASCII material for the document identity tuple.

Certification proved two concurrent registration commands with different idempotency keys and the same hard-unique document produce exactly one Customer:

```text
result kinds = CREATED + HARD_DUPLICATE
shared customerId = yes
```

### Certification incident retained as evidence

The first full B5 run `32808833057` failed because advisory-lock text used NUL separators, which PostgreSQL rejected as invalid UTF-8 text. Temporal retried the Activity three times and exposed the failure rather than advancing falsely.

The lock material was corrected to an ASCII SHA-256 representation without weakening duplicate semantics. The subsequent full run `32859253361` passed every B5 gate.

## B6 active target — mandatory MongoDB audit + success gate

B6 introduces required application execution/audit persistence and is the stage that can finally unlock truthful terminal success.

MongoDB must own application audit/workflow context, not Customer business truth.

B6 must implement and certify applicable success-gating milestones:

```text
REGISTRATION_SESSION_STARTED
REGISTRATION_POLICY_LOADED
REQUIRED_DATA_REQUESTED          when applicable
CUSTOMER_DATA_ACCEPTED           per logically accepted external input
DUPLICATE_CHECK_COMPLETED
EXISTING_CUSTOMER_RESOLVED       for ALREADY_EXISTS
CUSTOMER_CREATED                 for CREATED
REGISTRATION_COMPLETED
```

B6 must preserve retry-safe logical event identity and queryability by Workflow/correlation/customer where applicable.

Only after all applicable mandatory audit milestones exist may the Workflow publish:

```text
CREATED
or
ALREADY_EXISTS
```

If mandatory MongoDB audit remains unavailable after the frozen retry policy is exhausted:

```text
failureCode = MONGO_AUDIT_STORE_UNAVAILABLE
successful outcome = forbidden
```

Temporal Event History remains durable orchestration evidence for that failure.

B6 must not:

```text
turn MongoDB into a shadow Customer authority
write unrestricted request bodies or attachment binaries into audit
allow success while mandatory audit is missing
implement AttachmentStore
create Appointment/ResourceReservation
introduce Agent/Hermes
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

> **B0–B5 = CERTIFIED. B6 = ACTIVE.**
