# Build — mk0

## Status

**AUTHORIZED — STAGED B0–B6 / ATTACHMENT-FREE CORE COMPLETE**

Approval record:

```text
mk0/Plan/pre-build-approval-2026-08-24.md
```

Current Build position:

```text
B0  runtime/repository skeleton                            ✅ CERTIFIED
B1  canonical contracts + versioned RegistrationPolicy    ✅ CERTIFIED
B2  real Temporal runtime/topology + visibility proof     ✅ CERTIFIED
B3  first CLI CTA Adapter                                  ✅ CERTIFIED
B4  Worker + Task Queue + interactive RegisterNewCustomer ✅ CERTIFIED
B5  PostgreSQL duplicate/customer/registration Activities ✅ CERTIFIED
B6  MongoDB mandatory audit + terminal finalization       ✅ CERTIFIED
B7  AttachmentStore                                       🔒 GATED

NEXT → attachment-free mk0 core Golden / release certification
```

Certification evidence:

```text
B0 → mk0/Build/evidence/B0-runtime-certification-2026-08-24.md
B1 → mk0/Build/evidence/B1-contracts-policy-certification-2026-08-24.md
B2 → mk0/Build/evidence/B2-temporal-continuity-certification-2026-08-24.md
B3 → mk0/Build/evidence/B3-cli-cta-certification-2026-08-24.md
B4 → mk0/Build/evidence/B4-interactive-registration-certification-2026-08-24.md
B5 → mk0/Build/evidence/B5-postgres-authority-certification-2026-08-25.md
B6 → mk0/Build/evidence/B6-mongo-audit-finalization-certification-2026-08-25.md
```

`B7 AttachmentStore` remains explicitly gated until attachment technology + synthetic fixtures + expected SHA-256 values are frozen.

No application/web framework is selected or required for mk0.

## Certified attachment-free execution chain

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
MongoDB mandatory audit Activities
  ├── retry-safe logical milestones
  ├── PII-safe execution evidence
  └── success-gating verification
  ↓
PostgreSQL audited finalization
  ↓
CREATED | ALREADY_EXISTS
```

A soft duplicate remains durable at `WAITING_FOR_DUPLICATE_DECISION` and is not silently resolved.

A permanent mandatory MongoDB audit failure produces typed `MONGO_AUDIT_STORE_UNAVAILABLE` and forbids terminal success even when a PostgreSQL Customer row already exists.

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

B5 proved policy-driven hard uniqueness without installing a universal SQL `UNIQUE(document)` law. It uses a transaction-scoped advisory lock derived from stable SHA-256 ASCII material only when the active RegistrationPolicy requires the hard-unique document selector.

The B5 certification incident involving NUL advisory-lock separators is retained in its evidence record; Temporal exposed the Activity failure, the representation was corrected, and the full gate was rerun successfully.

## B6 certified mandatory audit + terminal finalization

B6 completed the attachment-free mk0 execution path.

Final certified receipt:

```text
Source SHA: 4403738cfc55159874ca7597d65856ae76bcdd7a
Run ID:     32870235091
Artifact:   mk0-b6-mongo-audit-finalization-32870235091
Digest:     sha256:c138e851ef9bd088fb0685859857d2e243e86d8f4045b18e635a1b615d3107be
```

Certified B6 assertions:

```text
mongoIndexesIdempotent                         PASS
auditLogicalIdentityRetrySafe                  PASS
auditConflictRejected                          PASS
waitingSessionAlreadyAudited                   PASS
customerDataUpdateAuditedBeforeMutation        PASS
newCustomerTerminalCreated                     PASS
hardDuplicateTerminalAlreadyExists             PASS
softDuplicateWaitsWithoutCompletionAudit       PASS
auditContainsNoCustomerPIIValues               PASS
activityOnlyPersistenceAccess                  PASS
postgresCompletionGatedByAudit                 PASS
mongoFailureAfterCustomerCreateForbidsSuccess  PASS
temporalRetriesMandatoryAudit                  PASS
```

### Mandatory logical event identity

MongoDB `execution_audit` uses deterministic retry-safe event identity and unique logical-event enforcement.

Exact retry reuses an existing event. A materially different replay for the same logical identity is rejected rather than overwriting evidence.

### Truthful CREATED path

Certified execution:

```text
Workflow ID: register-customer:golden-business:25e2d4512a679309b1e2ac1c17b2485a
Run ID:      01a039af-978d-7a59-9bab-d2bed10fe5ca
Customer ID: cus_c566084f-6997-4800-be68-808976a8279a
Temporal:    COMPLETED
PostgreSQL:  COMPLETED_CREATED
Result:      created = true
```

The intent-only execution was already audited while waiting. Its accepted Workflow Update was audited before durable draft mutation. `CUSTOMER_CREATED` and `REGISTRATION_COMPLETED` existed before PostgreSQL terminal completion.

### Truthful ALREADY_EXISTS path

```text
Workflow ID: register-customer:golden-business:da7b7ec182c976de5dd4cb816868b1bf
Run ID:      01a039af-aa9a-714f-9878-07edf23f5720
Customer ID: cus_c566084f-6997-4800-be68-808976a8279a
Temporal:    COMPLETED
PostgreSQL:  COMPLETED_ALREADY_EXISTS
Result:      created = false / HARD_UNIQUE
```

No second Customer was created.

### Soft duplicate remains unresolved

```text
Workflow ID: register-customer:golden-business:f20086d2468fac06ce54410d92a16e1b
Phase:       WAITING_FOR_DUPLICATE_DECISION
PostgreSQL:  SOFT_DUPLICATE_PENDING_DECISION
```

`DUPLICATE_CHECK_COMPLETED` exists; `REGISTRATION_COMPLETED` does not.

### Mandatory-audit failure cannot become success

Certification injected Mongo failure specifically at `CUSTOMER_CREATED`, after PostgreSQL had already persisted the Customer.

```text
Workflow ID: register-customer:golden-business:bbe6543969ce6a7c0cc5d0074f0b74da
Run ID:      01a039af-ca06-750d-aa6e-3ec69195aa49
PostgreSQL:  CUSTOMER_CREATED_PENDING_AUDIT
Temporal:    FAILED / MONGO_AUDIT_STORE_UNAVAILABLE
Mongo CUSTOMER_CREATED:       absent
Mongo REGISTRATION_COMPLETED: absent
terminal success:             forbidden
```

The mandatory audit Activity failed on attempts 1, 2 and 3 before the Workflow failed typed. Temporal Event History preserved the failure evidence.

### B6 certification harness incident

The first B6 negative test killed an `npm` wrapper PID while the original Worker child remained alive on the Task Queue. That happy Worker consumed the intended failure execution, making the fault test invalid.

The harness was fixed without changing product semantics: B6 Workers now expose and persist their actual Node PID for certification, and injected Workers expose the exact fault milestone. The complete B6 gate was rerun from zero and passed.

## Next gate — attachment-free core Golden / release certification

B0–B6 individually prove their stage contracts. The next recommended action is **not B7 yet**.

Before opening attachment persistence, certify the integrated attachment-free core against the applicable Golden Dataset scenarios and release invariants as one system:

```text
canonical CTA contract
interactive waiting / multi-round Update
business-scoped idempotency
initial fingerprint conflict
hard duplicate
soft duplicate waiting
PostgreSQL retry/idempotency behavior
Mongo audit retry/idempotency behavior
Worker restart / reconnect
no false success after mandatory audit failure
zero scheduling side effects
no attachment-bearing success while B7 is gated
```

This produces the first coherent **mk0 core release candidate/certification receipt**. Only after that gate should project authority decide whether to authorize B7 AttachmentStore.

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

> **B0–B6 = CERTIFIED. Attachment-free mk0 core path = COMPLETE. NEXT = integrated Golden / release certification. B7 = GATED.**
