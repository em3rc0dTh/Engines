# mk0 attachment-free core — integrated Golden release certification

## Verdict

```text
ATTACHMENT_FREE_CORE_GOLDEN_PASS
```

The attachment-free `RegisterNewCustomer` mk0 core is **system-certified** against every currently applicable case in the frozen Golden Dataset.

This receipt does **not** certify attachment-bearing mk0 behavior and does not authorize B7.

## Certified source and runtime receipt

```text
Repository:      em3rc0dTh/Engines
Branch:          cert/mk0-core-golden-release
Source SHA:      f0896c58d918e8f3971c78867870243e16a8b604
Golden version:  mk0.golden.register-customer.v0
GitHub run ID:   32873848134
Job ID:          97886979323
Run conclusion:  success
Artifact ID:     9573135809
Artifact:        mk0-core-golden-release-32873848134
Artifact digest: sha256:25fea20c892ea7cd758788ac63a53ba9048b8809599f2b972c5ef77942c2b4e8
```

Observed certification runtime:

```text
Node.js:               24.x certification lane
Temporal TypeScript:   1.22.0
Temporal CLI:          1.8.1
Temporal Server:       1.31.2
Temporal UI:           2.50.1
Namespace:             default
Task Queue:            engines-mk0-registration
PostgreSQL:            real containerized application store
MongoDB:               real containerized audit store
HTTP CTA framework:    none — node:http proof adapter
```

## Golden accounting

The frozen dataset contains 18 cases.

```text
14 attachment-free cases  PASS
4 attachment cases        DEFERRED_B7
18 total                  ACCOUNTED FOR
```

| Golden case | Integrated verdict | Meaning |
|---|---|---|
| GD-001 | PASS | minimal valid Customer through Postman-compatible HTTP CTA |
| GD-002 | PASS | full valid Customer through CLI CTA |
| GD-003 | DEFERRED_B7 | one attachment; AttachmentStore gate remains closed |
| GD-004 | DEFERRED_B7 | multiple attachments; AttachmentStore gate remains closed |
| GD-005 | PASS | exact replay after completed Workflow resolves same Workflow/Run and one business effect |
| GD-006 | PASS | materially different replay is typed `SESSION_IDEMPOTENCY_CONFLICT` |
| GD-007 | PASS | invalid structural start rejected before business execution |
| GD-008 | PASS | transient PostgreSQL `createCustomer` failure retries and produces one Customer |
| GD-009 | DEFERRED_B7 | transient AttachmentStore failure |
| GD-010 | DEFERRED_B7 | permanent attachment-integrity failure |
| GD-011 | PASS | Worker killed after PostgreSQL Customer persistence; same Workflow/Run recovers without duplicate Customer |
| GD-012 | PASS | zero scheduling side effects |
| GD-013 | PASS | HTTP CTA can die while accepted Workflow survives and is queryable from a fresh client |
| GD-014 | PASS | real Temporal Service / Task Queue / Worker / Workflow / Update / Activities / Event History path |
| GD-015 | PASS | legal intent-only start reaches `WAITING_FOR_REQUIRED_DATA` |
| GD-016 | PASS | multi-round `ProvideCustomerData` Updates complete same Workflow |
| GD-017 | PASS | hard duplicate resolves existing Customer and creates no second Customer |
| GD-018 | PASS | soft duplicate remains a policy decision state, not a hard duplicate |

## Integrated assertions

The machine-generated evidence receipt records:

```text
exactReplayAfterCompletion                   PASS
conflictingReplayTyped                       PASS
transientPostgresRetry                       PASS
postmanHttpProofSurface                      PASS
ctaDeathDoesNotKillWorkflow                  PASS
freshClientReconnect                         PASS
multiRoundUpdates                            PASS
realTemporalServiceTaskQueueWorkerHistory    PASS
workerKilledAfterCustomerPersistence         PASS
recoveryNoDuplicateCustomer                  PASS
hardDuplicateResolution                      PASS
softDuplicateDecisionState                   PASS
mandatoryMongoAuditBeforeSuccess             PASS
schedulingIsolation                          PASS
```

## Important release closure discovered by the integrated gate

The stage-by-stage B0–B6 certifications did not fully prove completed-session start replay.

The integrated review found that a plain Temporal start could not by itself distinguish:

```text
same business-scoped session + same frozen fingerprint
→ exact replay

same business-scoped session + different frozen fingerprint
→ SESSION_IDEMPOTENCY_CONFLICT
```

The release branch closed that gap by making the existing Temporal Workflow expose its immutable initial-start fingerprint and by using duplicate Workflow-ID rejection at start. On an existing Workflow ID, the orchestration port queries the existing execution:

```text
same fingerprint      → same Workflow ID + same Run ID
materially different  → SESSION_IDEMPOTENCY_CONFLICT
```

The CTA remains free of direct PostgreSQL authority.

### Certified terminal replay receipt

```text
Workflow ID: register-customer:golden-business:c62d36c87571ab613e78dd86b3842c0e
Run ID:      01a039d0-83f0-7382-8d3e-a13482e495a4
GD-001:      CREATED
GD-005:      same Workflow ID / same Run ID
GD-006:      typed conflict for different initial material
```

No second registration command or Customer was created by the exact replay.

## Postman / replaceable-channel proof

The integrated gate added a framework-free HTTP CTA implemented with Node's built-in `node:http`, plus an importable Postman collection.

The proof is intentionally stronger than merely calling an HTTP endpoint:

```text
Postman-compatible HTTP CTA
      ↓
start intent-only registration
      ↓
WAITING_FOR_REQUIRED_DATA
      ↓
kill HTTP CTA process
      ↓
Temporal Workflow remains accepted/alive
      ↓
fresh Temporal client queries same Workflow/Run
      ↓
ProvideCustomerData Update #1
      ↓
ProvideCustomerData Update #2
      ↓
COMPLETED / CREATED
```

Certified shared receipt for GD-013 / GD-014 / GD-015 / GD-016:

```text
Workflow ID: register-customer:golden-business:a61f07c8ef325644ef770fb5754c2dfd
Run ID:      01a039d0-ab30-73c2-82c6-44fc4defb064
```

This proves the channel process is disposable while the Workflow execution is not.

## GD-008 — transient PostgreSQL retry

Certification intentionally failed the first matching `createCustomer` Activity attempt for `GD008 Retry Customer`.

Worker evidence contains:

```text
CORE_POSTGRES_CREATE_INJECTED_FAILURE
injectedAttempt = 1
activityType = createCustomer
POSTGRES_CUSTOMER_STORE_UNAVAILABLE:forced-core-certification-transient
```

The same Workflow then completed successfully.

```text
Workflow ID: register-customer:golden-business:ff62668fcb953345dad299e1707f0929
Run ID:      01a039d0-a538-7ee6-98be-3f239990641d
PostgreSQL:  exactly one Customer
MongoDB:     mandatory completion audit present
Temporal:    COMPLETED
```

The gate therefore proves retry/recovery without duplicate business effect.

## GD-011 — Worker death after Customer persistence

This is the strongest restart proof in the attachment-free core.

A certification Worker deliberately delayed the `CUSTOMER_CREATED` audit Activity after PostgreSQL had already created the Customer.

Before killing the Worker, the gate observed:

```text
PostgreSQL registration status = CUSTOMER_CREATED_PENDING_AUDIT
Customer row                  = present exactly once
Customer contact projection   = present exactly once
terminal success              = not yet published
```

The delayed Worker was then killed with SIGKILL and replaced by a clean Worker on the same Task Queue.

Artifact markers:

```text
Delayed Worker PID:   5689
Recovery Worker PID:  6120
Workflow ID:          register-customer:golden-business:427a35365ca5875145b397e2b7f391ce
Run ID:               01a039d0-cadf-7dc8-bf39-e3703c2c8c86
```

The replacement Worker recovered the same Temporal execution and finished:

```text
PostgreSQL registration = COMPLETED_CREATED
Customer count           = 1
returned customerId      = original persisted customerId
Workflow                 = COMPLETED
```

This proves the process can survive Worker loss after a real business side effect without creating a duplicate Customer.

## PostgreSQL outcome summary from the artifact

The final integrated database evidence contains:

```text
GD-001 minimal Customer       COMPLETED_CREATED
GD-002 full Customer          COMPLETED_CREATED
GD-017 hard duplicate         COMPLETED_ALREADY_EXISTS
GD-018 soft duplicate         SOFT_DUPLICATE_PENDING_DECISION
GD-008 retry Customer         COMPLETED_CREATED
GD-016 interactive Customer   COMPLETED_CREATED
GD-011 restart Customer       COMPLETED_CREATED
```

Five canonical Customer rows exist for the five genuinely-created logical Customers in the integrated run. Hard duplicate reused the GD-002 Customer, and soft duplicate created none.

## Scheduling isolation

GD-012 verified no Appointment, ResourceReservation or Availability persistence surface exists in the mk0 `RegisterNewCustomer` runtime path and no scheduling mutation API is called by the Workflow/Activities.

```text
appointment delta              0
resource reservation delta     0
availability mutation delta    0
```

## Attachment boundary

The integrated release gate did not fabricate attachment support.

```text
GD-003  DEFERRED_B7
GD-004  DEFERRED_B7
GD-009  DEFERRED_B7
GD-010  DEFERRED_B7
```

Attachment-bearing execution remains blocked by `ATTACHMENT_BUILD_GATE_CLOSED` until B7 is separately authorized and the following are frozen:

- physical AttachmentStore technology;
- synthetic fixture binaries;
- expected SHA-256 values;
- ingress/commit/retrieval semantics;
- size/count/TTL rules;
- corruption and retry fixtures.

## Certification incidents retained

Two early integrated runs failed before this final receipt. Neither failure was hidden.

1. The first gate expected a retryable Activity attempt to appear using an incorrect Event History failure shape. Worker evidence already proved the retry; the assertion was corrected to use Worker retry evidence plus durable Temporal scheduled/completed history.
2. The second gate queried a nonexistent denormalized `customers.email` column. The canonical schema stores email in `customer_contacts.email_normalized`. All related Golden assertions and evidence dumps were corrected to the canonical relational projection.

The complete 14-case attachment-free matrix was rerun from empty persistence/runtime state after those corrections and passed at run `32873848134`.

## Release interpretation

This receipt authorizes the following statement:

> **The mk0 attachment-free `RegisterNewCustomer` core is integrated-Golden certified and release-ready as a laboratory core.**

It does not authorize these stronger statements:

```text
full mk0 including attachments is complete     NO
B7 AttachmentStore is authorized               NO
production deployment is certified             NO
all future Engines workflows are implemented   NO
all future channels are implemented            NO
```

## Next project gate

The next engineering transition is no longer another core-orchestration feature.

```text
ATTACHMENT-FREE MK0 CORE      ✅ SYSTEM CERTIFIED
               ↓
PROJECT AUTHORITY B7 DECISION
               ↓
freeze AttachmentStore technology + fixtures + hashes
               ↓
B7 implementation / attachment Golden cases
               ↓
FULL MK0 GOLDEN CERTIFICATION
```

Until a separate B7 authorization exists, the correct status remains:

```text
B7 = GATED
FULL MK0 = NOT YET COMPLETE
```
