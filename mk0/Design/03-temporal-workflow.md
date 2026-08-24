# 03 — Temporal Workflow Design

## 1. Workflow identity

Workflow type:

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

## 2. Workflow input

The Workflow receives a normalized command envelope containing:

- `businessSlug`;
- Customer command data;
- `commandFingerprint`;
- correlation metadata;
- opaque attachment ingress references when present;
- schema/contract version.

Large attachment bytes do not belong in ordinary Workflow input/history.

## 3. Workflow state machine

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
      PERSISTING_ATTACHMENTS  → MongoDB Activity
        ↓                              │
      LINKING_ATTACHMENTS     → PostgreSQL Activity
        └──────────────────────────────┘
                     ↓
             FINALIZING_CUSTOMER       → PostgreSQL Activity
                     ↓
             COMPLETED
```

MongoDB audit/context milestones are appended at the selected workflow phases through explicit Activities.

## 4. Activity boundaries

### `reserveRegistrationCommand` — PostgreSQL

Purpose:

- persist/verify durable idempotency receipt;
- compare command fingerprint;
- return the existing registration identity on valid replay;
- reject same key with a different material command.

Must be idempotent.

### `createCustomerRegistrationBase` — PostgreSQL

Purpose:

- create the canonical Customer registration identity/record;
- recover the existing record when the Activity is retried;
- return stable `customerId`.

Must be idempotent against workflow/command identity.

### `commitAttachment` — MongoDB, optional

Purpose:

- resolve an opaque ingress reference;
- verify metadata/hash;
- persist the optional attachment/document object through the MongoDB attachment capability;
- return stable opaque attachment metadata.

Must be idempotent by ingress/content/workflow identity.

### `linkCustomerAttachments` — PostgreSQL, optional

Purpose:

- persist opaque attachment references against the Customer/registration business record;
- never copy the binary object into PostgreSQL;
- tolerate retry without duplicate references.

### `appendExecutionAudit` — MongoDB

Purpose:

- persist selected application-level workflow milestones;
- preserve queryable correlation/workflow/customer evidence;
- remain separate from Temporal Event History.

### `finalizeCustomerRegistration` — PostgreSQL

Purpose:

- verify all mandatory registration effects;
- mark the authoritative registration as successfully finalized;
- tolerate retry without changing the logical outcome.

## 5. Audit milestones — MongoDB

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

Audit events contain IDs/classifications and sanitized metadata, not unrestricted Customer request bodies.

## 6. Retry semantics

Potentially transient:

- PostgreSQL temporarily unavailable;
- MongoDB temporarily unavailable;
- worker/process crash;
- network interruption after a side effect but before Activity completion is recorded.

Normally permanent without a changed command/environment:

- invalid command schema;
- expired/invalid attachment ingress reference;
- attachment integrity mismatch;
- same idempotency key with different fingerprint;
- explicit business-policy rejection.

Retry classification is typed at the Activity/application boundary.

## 7. Idempotency requirements

### PostgreSQL Customer

A retried Activity cannot perform an unconditional new insert every time. A stable registration/command identity must return the same logical Customer.

### MongoDB attachment/document

A retried commit after the object already persisted must return/recover the same logical attachment rather than creating a duplicate merely because the first Activity acknowledgement was lost.

### MongoDB audit

A conceptual milestone requires a stable event/deduplication identity when Activity retries occur, unless separate retry-attempt records are intentionally part of the model.

## 8. Cross-store consistency

PostgreSQL and MongoDB do not share one application transaction.

mk0 therefore uses **workflow-mediated consistency**.

A Customer is not reported as successfully finalized until:

1. the PostgreSQL Customer/registration record exists;
2. every requested mandatory attachment/document is committed in MongoDB;
3. PostgreSQL contains the corresponding opaque reference(s);
4. required audit milestones are persisted according to policy;
5. finalization preconditions pass.

Failure handling:

- transient side-effect failure → Temporal retries;
- permanent attachment failure → workflow fails, Customer is not reported as successful;
- MongoDB attachment committed but PostgreSQL link fails → retry/reconcile existing attachment;
- PostgreSQL link succeeds but workflow completion is lost → idempotent finalization returns existing outcome.

Deletion-based rollback is not the default. Durable partial evidence must remain diagnosable and reconcilable.

## 9. Temporal persistence is separate

Temporal's own server persistence is an infrastructure concern.

Even if a local/production Temporal cluster uses PostgreSQL internally:

```text
Temporal persistence schema
≠
Engines mk0 application PostgreSQL Customer schema
```

No Customer authority may accidentally migrate into Temporal internal tables.

## 10. Workflow query contract

A safe status projection exposes:

- `workflowId`;
- workflow status;
- current mk0 phase;
- `customerId` if assigned;
- requested/committed attachment counts;
- timestamps;
- correlation ID;
- typed failure classification.

Ordinary API callers do not receive raw Temporal Event History.

## 11. Cancellation

Arbitrary cancellation is outside the first mk0 CTA capability. It can be designed later after partial-persistence semantics are explicitly defined.

## 12. Versioning

At minimum preserve/version:

- workflow type;
- command schema;
- PostgreSQL business persistence schema;
- MongoDB audit/document schema;
- golden dataset version.

## 13. Temporal gate

The design is accepted only if future tests can prove:

- same command replay yields one PostgreSQL Customer;
- Activity retry after side effect does not duplicate Customer or attachment;
- worker restart resumes execution;
- transient PostgreSQL failure retries;
- transient MongoDB failure retries;
- permanent attachment integrity failure is deterministic;
- Workflow code calls neither PostgreSQL nor MongoDB directly;
- workflow failure remains queryable;
- Customer is not finalized before mandatory attachment/reference effects complete.
