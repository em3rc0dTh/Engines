# 03 — Temporal Workflow Design

## 1. Temporal role in mk0

`Temporal` means the real Temporal orchestration platform: Temporal Service + durable Event History + Task Queues + Workers + Workflows + Activities + visibility/query capabilities.

mk0 must not reproduce Temporal with a custom local state machine.

The first Workflow type is:

`RegisterNewCustomer`

Recommended Workflow ID:

```text
register-customer:{businessSlug}:{hash(Idempotency-Key)}
```

Goals:

- deterministic identity;
- duplicate-start resistance;
- no raw idempotency key in ordinary logs;
- business/tenant scoping through `businessSlug`.

## 2. Temporal platform capabilities available to Engines

The Orchestration Engine is designed around the full Temporal model:

- durable Workflow Execution;
- Event History / deterministic replay;
- Task Queues;
- Workers;
- Activities for side effects;
- retries, backoff and timeouts;
- crash/restart recovery;
- Queries for read-only Workflow state;
- Signals for asynchronous external events when later required;
- Updates for controlled synchronous Workflow mutations when later required;
- Child Workflows when future decomposition needs them;
- cancellation/compensation semantics when explicitly designed;
- visibility/search metadata for operations;
- Workflow versioning/replay compatibility.

`RegisterNewCustomer` only needs a subset of these on day one, but it must run inside this complete architecture so future workflows do not require a replacement orchestrator.

## 3. CTA to Temporal boundary

All channels converge through the CTA Adapter contract.

```text
Postman / CLI / future channel
→ CTA Adapter
→ canonical RegisterNewCustomer command
→ Temporal Client
→ Temporal Service
→ Task Queue
→ Worker
→ RegisterNewCustomer Workflow
```

The CTA Adapter is not a Workflow engine.

A CLI may implement the adapter semantics directly with the official Temporal client/SDK.

For Postman, the preferred architecture is a transport-compatible CTA Adapter. Exposing Temporal-native protocol/payload details directly to every channel would create channel-to-orchestrator coupling that the platform diagram explicitly avoids.

## 4. Workflow input

The Workflow receives a normalized command envelope containing:

- `businessSlug`;
- Customer command data;
- `commandFingerprint`;
- correlation metadata;
- opaque attachment ingress references when present;
- schema/contract version;
- safe channel/source metadata only when required.

Large attachment bytes do not belong in ordinary Workflow input/history.

## 5. Workflow state machine

```text
ACCEPTED
   ↓
VALIDATING_COMMAND
   ↓
RESERVING_IDEMPOTENCY       → PostgreSQL Activity
   ↓
PERSISTING_CUSTOMER_BASE    → PostgreSQL Activity
   ↓
attachments requested?
   ├─ no ───────────────────────────────┐
   └─ yes                              │
        ↓                              │
      PERSISTING_ATTACHMENTS  → AttachmentStore Activity
        ↓                              │
      LINKING_ATTACHMENTS     → PostgreSQL Activity
        └──────────────────────────────┘
                     ↓
             PERSISTING_AUDIT_CONTEXT  → MongoDB Activity
                     ↓
             FINALIZING_CUSTOMER       → PostgreSQL Activity
                     ↓
             COMPLETED
```

Selected audit milestones may also be emitted earlier at accepted/validated/persisted phases as required by policy.

## 6. Task Queue and Worker boundary

Build must use real Temporal Task Queue/Worker semantics.

Design-level rule:

```text
Temporal Service
→ Task Queue
→ registered Worker
→ Workflow/Activity implementation
```

The exact number/names of Task Queues and Worker processes are Build decisions. mk0 may begin with a simple topology, but the design must preserve later separation by capability or operational scaling.

Workers may restart or scale without changing the logical Workflow identity/outcome.

## 7. Activity boundaries

### `reserveRegistrationCommand` — PostgreSQL

Purpose:

- persist/verify durable idempotency receipt;
- compare command fingerprint;
- return existing registration identity on valid replay;
- reject same key with a different material command.

Must be idempotent.

### `createCustomerRegistrationBase` — PostgreSQL

Purpose:

- create the canonical Customer registration identity/record;
- recover the existing record when retried;
- return stable `customerId`.

Must be idempotent against Workflow/command identity.

### `commitAttachment` — AttachmentStore, optional

Purpose:

- resolve an opaque ingress reference;
- verify expected metadata/hash;
- persist the attachment/document through the selected AttachmentStore implementation;
- return stable opaque attachment metadata.

Must be idempotent by ingress/content/workflow identity.

### `linkCustomerAttachments` — PostgreSQL, optional

Purpose:

- persist opaque attachment references against the Customer/registration business record;
- never copy raw binary content into the canonical Customer relation merely for convenience;
- tolerate retry without duplicate references.

### `appendExecutionAudit` — MongoDB

Purpose:

- persist selected application-level milestones;
- preserve queryable correlation/workflow/customer evidence;
- remain separate from Temporal Event History.

### `finalizeCustomerRegistration` — PostgreSQL

Purpose:

- verify all mandatory registration effects;
- mark the authoritative registration as successfully finalized;
- tolerate retry without changing the logical outcome.

## 8. Queries, Signals and Updates

### Queries — required design capability

The CTA must be able to inspect a safe Workflow projection without reading raw Temporal Event History.

Query projection includes:

- `workflowId`;
- Workflow status;
- current mk0 phase;
- `customerId` if assigned;
- requested/committed attachment counts;
- correlation ID;
- timestamps;
- typed failure classification.

### Signals / Updates — available, not forced into the first happy path

`RegisterNewCustomer` does not need arbitrary external mutation to prove its basic path.

However the Orchestration Engine must preserve Temporal Signals/Updates as first-class mechanisms for later workflows such as:

- missing-information responses;
- approval/correction steps;
- asynchronous channel confirmations;
- human-in-the-loop decisions;
- reschedule/cancel operations.

Do not invent ad-hoc polling/database flags when a future interaction is properly modeled as a Temporal interaction.

## 9. Audit milestones — MongoDB

Minimum mk0 set:

```text
REGISTER_CUSTOMER_ACCEPTED
REGISTER_CUSTOMER_VALIDATED
IDEMPOTENCY_RESERVED
CUSTOMER_BASE_PERSISTED
ATTACHMENT_COMMITTED          optional / repeated
CUSTOMER_ATTACHMENTS_LINKED   optional
CUSTOMER_REGISTRATION_ACTIVE
REGISTER_CUSTOMER_FAILED      terminal failure
```

Audit events contain identifiers/classifications and sanitized metadata, not unrestricted Customer request bodies.

Temporal Event History remains the orchestration history. MongoDB audit remains the application/business audit projection.

## 10. Retry semantics

Potentially transient:

- PostgreSQL temporarily unavailable;
- MongoDB temporarily unavailable;
- AttachmentStore temporarily unavailable;
- Worker/process crash;
- network interruption after side effect but before Activity completion is recorded.

Normally permanent without changed command/environment:

- invalid command schema;
- expired/invalid attachment ingress reference;
- attachment integrity mismatch;
- same idempotency key with different fingerprint;
- explicit business-policy rejection.

Retry classification is typed at the Activity/application boundary.

Temporal owns the retry execution. The CTA must not reproduce business retries.

## 11. Idempotency requirements

### PostgreSQL Customer

A retried Activity cannot perform an unconditional new insert on every attempt. A stable registration/command identity must resolve the same logical Customer.

### AttachmentStore object

A retried commit after the object already persisted must return/recover the same logical attachment rather than create another because the first Activity acknowledgement was lost.

### MongoDB audit

A conceptual milestone needs a stable event/deduplication identity when Activity retries occur, unless separate retry-attempt records are intentionally part of the model.

## 12. Cross-store consistency

PostgreSQL, MongoDB and AttachmentStore do not share one application transaction.

mk0 uses **Temporal-mediated workflow consistency**.

A Customer is not reported successfully finalized until:

1. the PostgreSQL Customer/registration record exists;
2. every requested mandatory attachment/document is committed in AttachmentStore;
3. PostgreSQL contains the expected attachment reference(s);
4. required MongoDB audit/context milestones are persisted according to policy;
5. finalization preconditions pass.

Failure handling:

- transient side-effect failure → Temporal retries;
- permanent attachment failure → Workflow fails, Customer is not reported successful;
- attachment committed but PostgreSQL link fails → retry/reconcile existing attachment;
- PostgreSQL link succeeds but final Workflow acknowledgement is lost → idempotent finalization returns existing outcome.

Deletion-based rollback is not the default. Durable partial evidence remains diagnosable/reconcilable.

## 13. Temporal persistence is separate

Temporal's own server persistence is an infrastructure concern.

Even if the Temporal cluster uses PostgreSQL internally:

```text
Temporal infrastructure persistence
≠
Engines application PostgreSQL Customer persistence
```

No Customer authority may migrate into or depend on Temporal internal tables.

## 14. Continuity proof

The first release gate must prove:

```text
CTA submits command
→ Temporal returns durable Workflow identity
→ CTA process/session disappears
→ Worker may also restart during execution
→ Temporal continues/resumes
→ persistence completes once logically
→ a later CTA session queries the same Workflow identity
→ same final result is observed
```

This is the mk0 interpretation of continuous orchestration.

## 15. Versioning

At minimum preserve/version:

- Workflow type;
- command schema;
- Workflow code/replay strategy;
- PostgreSQL business schema;
- MongoDB audit/context schema;
- AttachmentStore reference schema;
- Golden Dataset version.

## 16. Temporal gate

The design is accepted only if future tests prove:

- a real Temporal Service/Worker/Task Queue path is used;
- same command replay yields one PostgreSQL Customer;
- Activity retry after side effect does not duplicate Customer/attachment;
- Worker restart resumes execution;
- CTA disconnect does not stop execution;
- transient PostgreSQL failure retries;
- transient MongoDB failure retries;
- transient AttachmentStore failure retries;
- permanent attachment integrity failure is deterministic;
- Workflow code calls no persistence/network/file driver directly;
- Workflow status remains queryable after failure/restart;
- Customer is not finalized before mandatory effects complete.
