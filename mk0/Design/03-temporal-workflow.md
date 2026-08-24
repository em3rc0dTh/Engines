# 03 — Temporal Workflow Design

## 1. Temporal role in mk0

`Temporal` means the real Temporal orchestration platform: Temporal Service, durable Event History, Task Queues, Workers, Workflows, Activities, Workflow message passing, visibility and restart/retry semantics.

mk0 must not reproduce Temporal with a custom local state machine.

The first Workflow type is:

`RegisterNewCustomer`

This Workflow is intentionally **long-running and interactive** when required Customer data is incomplete.

## 2. Why interactive Temporal fits the architecture

Temporal Workflows can behave as stateful services that receive Queries, Signals and Updates. For mk0:

- **Query** reads the current registration state;
- **Update** submits/changes registration data and returns a tracked result;
- **Signal** remains available for future asynchronous channel events where a direct response is not required.

The CTA therefore does not own a conversation state machine. Temporal owns it durably.

Conceptual interaction:

```text
CTA starts RegisterNewCustomer
→ Temporal loads policy
→ Workflow determines missing fields
→ Workflow waits durably
→ CTA Query reads missing fields
→ CTA Update provides data
→ Workflow revalidates
→ repeats until complete
→ duplicate check
→ persistence/audit/finalization
→ terminal result
```

A CTA can disappear for minutes, hours or longer while the Workflow remains the authority for that registration session.

## 3. Workflow identity and start replay

Recommended Workflow ID:

```text
register-customer:{businessSlug}:{hash(startIdempotencyKey)}
```

The authoritative registration identity is business-scoped:

```text
(operation, businessSlug, idempotencyKeyHash)
```

The initial idempotency key identifies the registration session/intent. The normalized material **initial start snapshot** is fingerprinted so an exact transport retry can be distinguished from an attempt to reuse the same business-scoped session identity with materially different initial input.

Conceptual initial fingerprint material:

```text
operation
businessSlug
schemaVersion
normalized initial Customer draft
normalized initial attachment ingress identities / expected integrity metadata
```

Rules:

```text
same business-scoped identity + same initial fingerprint
→ same logical Workflow/session

same business-scoped identity + materially different initial fingerprint
→ SESSION_IDEMPOTENCY_CONFLICT
→ no second business effect
```

The durable Customer draft may evolve through later Updates. Those Updates have their own stable input identities and do **not** rewrite the original start fingerprint.

Goals:

- duplicate-start resistance;
- stable identity across CTA reconnects;
- deterministic conflicting-start detection;
- no raw idempotency key in ordinary logs;
- tenant/business scoping through `businessSlug`.

Each later external input carries a stable `inputId`/Update identity so repeated channel delivery does not produce duplicate logical interactions.

## 4. CTA to Temporal boundary

```text
Postman / CLI / future channel
→ CTA Adapter
→ Temporal Client
→ Temporal Service
→ Task Queue
→ Worker
→ RegisterNewCustomer Workflow
```

The CTA Adapter is replaceable and owns no durable business process state.

Postman may use a framework-free transport adapter. CLI may invoke the official Temporal client directly while preserving the same canonical message contract.

## 5. Workflow start input

Start input may be incomplete:

```text
operation = RegisterNewCustomer
businessSlug
start idempotency identity
correlation/channel metadata
optional initial Customer draft
schema version
```

Only the minimum envelope required to start a legal registration session must exist.

Missing Customer name/contact/document fields are handled inside the durable Workflow according to the resolved policy rather than automatically rejecting the Workflow before start.

## 6. Versioned RegistrationPolicy

At the beginning of execution Temporal resolves a versioned registration policy through an Activity.

Conceptual Activity:

`loadRegistrationPolicy`

The result contains the frozen rules for this execution:

```text
policyId
policyVersion
requiredCustomerFields
normalizationRules
duplicatePolicy
attachmentPolicy
completionRules
```

This policy is conceptually derived from the approved BusinessProfile/WorkflowProfile configuration or equivalent application configuration.

Because the Activity result becomes part of the Workflow execution history, an already-running registration does not silently change requirements when configuration changes later.

## 7. Workflow state machine

Both successful business outcomes — `CREATED` and `ALREADY_EXISTS` — must pass through required application audit and authoritative registration finalization before terminal success.

```text
STARTED
   ↓
LOADING_REGISTRATION_POLICY      → config/profile Activity
   ↓
COLLECTING_DATA
   ↓
VALIDATING_DRAFT
   ├── missing data ──────────────┐
   │                              ▼
   │                    WAITING_FOR_REQUIRED_DATA
   │                              │
   │                    ProvideCustomerData Update
   │                              │
   └──────────────────────────────┘
   ↓ complete
CHECKING_EXISTING_CUSTOMER        → PostgreSQL Activity
   ├── hard duplicate
   │       ↓
   │  OUTCOME_ALREADY_EXISTS
   │       └──────────────────────────────┐
   │                                      │
   ├── soft duplicate requiring decision │
   │       ↓                              │
   │  WAITING_FOR_DUPLICATE_DECISION     │
   │       ↓ Update                       │
   │       └───────────────┐              │
   │                       │              │
   └── new                 │              │
           ↓               │              │
   RESERVING_REGISTRATION  → PostgreSQL   │
           ↓                              │
   PERSISTING_CUSTOMER     → PostgreSQL   │
           ↓                              │
   attachments requested?                 │
      ├─ no ───────────────────┐          │
      └─ yes                   │          │
           ↓                   │          │
     PERSISTING_ATTACHMENTS    → AttachmentStore
           ↓                   │          │
     LINKING_ATTACHMENTS       → PostgreSQL
           └───────────────────┘          │
                   ↓                      │
            OUTCOME_CREATED               │
                   └──────────────┬───────┘
                                  ↓
                       PERSISTING_AUDIT_CONTEXT
                                  → MongoDB
                                  ↓
                       FINALIZING_REGISTRATION
                                  → PostgreSQL
                                  ↓
                    COMPLETED / CREATED
                         or
                    COMPLETED / ALREADY_EXISTS
```

The exact physical placement/frequency of audit Activities may be refined in Build, but the applicable logical success-gating milestones must be durably represented before either successful terminal outcome is exposed.

A MongoDB failure that prevents required audit persistence after the frozen retry policy is exhausted must not transition to successful `COMPLETED`.

## 8. Query contract

Required Query:

`GetRegistrationState`

Safe projection includes:

```text
workflowId
workflowStatus
phase
policyVersion
knownFields
missingFields
validationErrors
nextAction
possibleDuplicate?
customerId?
created?
correlationId
failure?
```

Queries are read-only and must not execute database Activities.

This Query is the primary mechanism for Postman/CLI to see **where the interaction currently is**.

## 9. Update contract

Required Update:

`ProvideCustomerData`

Purpose:

- accept a structurally valid Customer patch;
- normalize permitted values;
- merge into the durable draft;
- update known/missing fields;
- return the latest safe registration projection;
- ensure accepted interaction is included in the audit policy.

Optional future Updates:

```text
ResolveDuplicateDecision
ProvideAttachmentReference
CorrectCustomerData
CancelRegistration
```

Only explicitly designed Updates are accepted.

Update identity is independent of start replay identity. A repeated `inputId` must not create another logical interaction, and an accepted Update does not mutate the frozen initial-start fingerprint.

## 10. Activity boundaries

### `loadRegistrationPolicy` — application configuration/profile source

Reads the versioned requirements for the current business/workflow.

Must return a stable policy version for the execution.

### `findExistingCustomer` — PostgreSQL

Purpose:

- query canonical Customer identity using policy-defined hard/soft duplicate keys;
- return deterministic candidate classifications;
- never create/update a Customer.

The Workflow does not query PostgreSQL directly.

### `reserveRegistration` — PostgreSQL

Purpose:

- bind the Workflow/session identity and initial-start fingerprint to one logical registration outcome;
- make creation retry-safe;
- tolerate Activity retry;
- reject materially conflicting reuse of the same business-scoped registration identity.

### `createCustomer` — PostgreSQL

Purpose:

- persist the canonical TimeSlots-aligned Customer projection;
- return a stable `customerId`;
- recover existing side effect on retry rather than duplicate it.

### `commitAttachment` — AttachmentStore, optional

Resolves/commits attachment ingress and returns stable opaque attachment metadata.

### `linkCustomerAttachments` — PostgreSQL, optional

Links opaque attachment references to the business record idempotently.

### `appendInteractionAudit` — MongoDB

Records accepted CTA/Workflow interaction milestones with safe metadata and stable logical event identity.

Success-gating examples:

```text
REGISTRATION_SESSION_STARTED
REGISTRATION_POLICY_LOADED
REQUIRED_DATA_REQUESTED              when applicable
CUSTOMER_DATA_ACCEPTED               per accepted logical input
DUPLICATE_CHECK_COMPLETED
EXISTING_CUSTOMER_RESOLVED           for ALREADY_EXISTS
CUSTOMER_CREATED                     for CREATED
ATTACHMENT_COMMITTED                 when applicable
REGISTRATION_COMPLETED
```

Other diagnostic events may be recorded without becoming independent success authority.

### `finalizeCustomerRegistration` — PostgreSQL

Despite the historical Activity name, its mk0 responsibility is to verify the mandatory effects and persist/finalize the authoritative **registration outcome**, whether that outcome is `CREATED` or `ALREADY_EXISTS`.

It must not claim successful finalization while applicable success-gating audit evidence is missing.

## 11. Duplicate semantics

Temporal orchestrates duplicate detection; PostgreSQL remains the source queried for Customer truth.

The Workflow must not hard-code that phone, email or name is universally unique.

The RegistrationPolicy classifies identifiers as:

```text
HARD_UNIQUE
SOFT_MATCH
NON_UNIQUE
```

Typical generic guidance:

- verified business-scoped document ID may be hard unique if policy says so;
- phone/email may be soft matches because families/organizations can share them;
- name alone is never a hard uniqueness key.

Hard duplicate business result:

```text
created = false
phase = ALREADY_EXISTS
customerId = existing customer
```

No second Customer is persisted, but the Workflow still must persist the required duplicate/outcome audit evidence and finalize the registration command before exposing successful completion.

## 12. Interaction audit vs Temporal Event History

Temporal Event History is the orchestration truth.

MongoDB contains a separate application audit/interaction projection useful for business troubleshooting and future channel analytics.

MongoDB should not blindly duplicate full Temporal history or unrestricted PII. Exact production PII retention/encryption policy is a later production gate; mk0 tests use synthetic data and must not contain unrestricted real Customer PII.

Mandatory application audit is a success precondition, not a replacement for Temporal history. If MongoDB itself is unavailable beyond the frozen retry policy, Temporal remains the durable evidence of that failure and the Workflow cannot report successful registration.

## 13. Task Queues and Workers

Build must use real Temporal Task Queue/Worker semantics:

```text
Temporal Service
→ Task Queue
→ Worker
→ Workflow/Activity execution
```

The first topology may be simple, but must prove:

- real Worker polling;
- restart/resume;
- Activity retry;
- Workflow message handling;
- Event History/visibility.

## 14. Retry and continuity

Potential transient failures:

- PostgreSQL unavailable;
- MongoDB unavailable;
- AttachmentStore unavailable;
- Activity acknowledgement lost after side effect;
- Worker/process restart;
- CTA disconnect.

Temporal owns durable recovery and retry execution.

CTA retries must use stable start/input identities so duplicate starts or messages resolve safely.

Retry after a side effect must recover the same logical registration, Customer, audit milestone or attachment rather than create another one.

## 15. Cross-store consistency

PostgreSQL, MongoDB and AttachmentStore do not share one atomic transaction.

Temporal coordinates the process.

A new Customer is reported `CREATED` only after mandatory persistence, audit and finalization succeeds.

An existing Customer is reported successful `ALREADY_EXISTS` only after required duplicate/outcome audit and registration finalization succeeds.

Permanent attachment/persistence/audit failure cannot be converted to success.

Partial effects remain diagnosable/reconcilable rather than being hidden by ad-hoc destructive rollback.

## 16. Visibility / laboratory observability

mk0 uses three distinct evidence planes:

```text
Temporal Web UI / CLI
→ Workflow state, Event History, Task Queue, Worker, Activities, retries

PostgreSQL
→ canonical Customer and registration result

MongoDB
→ required application interaction/audit projection
```

A later Engines control-room UI may combine these views, but mk0 does not need to build that UI to prove the architecture.

## 17. Temporal infrastructure persistence is separate

Temporal server persistence is infrastructure state.

Even when Temporal uses PostgreSQL internally:

```text
Temporal infrastructure PostgreSQL
≠
Engines application PostgreSQL
```

Never read/write Temporal internal tables as Customer business storage.

## 18. Workflow replay/version compatibility

Pre-Build invariant:

> A deployed Workflow change must preserve deterministic replay/version compatibility for executions whose Event History was produced by an older implementation.

The exact Temporal SDK language/version and SDK-specific versioning mechanism are Build-time decisions. Build must record the selected mechanism before introducing a change that would otherwise make existing histories non-replay-compatible.

A Build-time mechanism is acceptable only if it preserves the invariant above; implementation choice cannot redefine the invariant.

## 19. Temporal gate

The design passes only when runtime tests can prove:

- real Temporal Service/Task Queue/Worker execution;
- intent-only/partial registration can start and wait durably;
- Query exposes missing fields/current phase;
- Update adds Customer data to the same Workflow;
- accepted Updates do not rewrite the initial-start fingerprint;
- exact start replay resolves the same business-scoped Workflow/session;
- same-business/same-key conflicting initial start is rejected without a second business effect;
- CTA disconnect/reconnect preserves the same Workflow state;
- required fields are driven by a versioned policy;
- duplicate lookup is performed through a PostgreSQL Activity;
- hard duplicate yields existing Customer with no second insert;
- new Customer creates exactly one PostgreSQL record;
- applicable success-gating interactions/outcomes are represented in MongoDB audit before successful completion;
- exhausted required-audit failure cannot produce `CREATED` or successful `ALREADY_EXISTS`;
- Worker restart resumes the same execution;
- Activity retry after side effect does not duplicate business state;
- optional attachments remain retry-safe;
- zero scheduling side effects occur.
