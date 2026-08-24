# 03 — Temporal Workflow Design

## 1. Workflow identity

Workflow type:

`RegisterNewCustomer`

Recommended Workflow ID shape:

```text
register-customer:{businessSlug}:{hash(Idempotency-Key)}
```

Goals:

- deterministic identity;
- duplicate-start resistance;
- no raw idempotency key in logs;
- business/tenant scoping via `businessSlug`.

---

## 2. Workflow input

The Workflow receives a normalized command envelope containing:

- `businessSlug`;
- customer command data;
- `commandFingerprint`;
- correlation metadata;
- opaque attachment ingress references, when present;
- schema/contract version.

The Workflow should not receive large attachment bytes.

---

## 3. Workflow state machine

```text
ACCEPTED
   ↓
VALIDATING_COMMAND
   ↓
RESERVING_IDEMPOTENCY
   ↓
PERSISTING_CUSTOMER_BASE
   ↓
┌───────────────────────────┐
│ attachments requested?    │
└───────┬───────────┬───────┘
        │ no        │ yes
        │           ▼
        │     PERSISTING_ATTACHMENTS
        │           ↓
        │     LINKING_ATTACHMENTS
        │           │
        └───────────┘
              ↓
FINALIZING_CUSTOMER
              ↓
COMPLETED
```

Any non-recoverable failure produces a typed failed outcome while preserving enough durable state for diagnosis and safe retry/recovery.

---

## 4. Activity boundaries

Workflow code coordinates. Activities perform side effects.

Proposed Activities:

### `reserveRegistrationCommand`

Purpose:

- persist/verify idempotency command receipt;
- compare command fingerprint;
- return existing registration identity when replayed safely;
- reject same key with different fingerprint.

Must be idempotent.

### `createCustomerRegistrationBase`

Purpose:

- create the canonical customer registration record or recover the existing record for this command;
- return stable `customerId`.

Must be idempotent against Workflow/command identity.

### `commitAttachment`

One Activity invocation per requested attachment, or a carefully bounded batch.

Purpose:

- resolve `ingressRef`;
- verify expected hash/metadata;
- persist content into the local attachment database/store;
- return opaque committed attachment metadata.

Must be idempotent by attachment ingress/content identity.

### `linkCustomerAttachments`

Purpose:

- attach committed metadata/references to the Customer document;
- never embed binary content;
- tolerate retry without duplicate references.

### `finalizeCustomerRegistration`

Purpose:

- make the customer visible as the final successful registration state according to the approved persistence model;
- verify all requested mandatory effects are present.

### `appendExecutionAudit`

Purpose:

- persist selected application-level audit milestones.

Important:

Audit failure policy must be explicit. For compliance-critical milestones, audit persistence may be mandatory. For high-volume diagnostic detail, it must not create an uncontrolled source of workflow failure.

mk0 begins with a small mandatory milestone set rather than logging every internal line.

---

## 5. Audit milestone set — mk0

Minimum application events:

```text
REGISTER_CUSTOMER_ACCEPTED
REGISTER_CUSTOMER_VALIDATED
IDEMPOTENCY_RESERVED
CUSTOMER_BASE_PERSISTED
ATTACHMENT_COMMITTED          repeated per attachment
CUSTOMER_ATTACHMENTS_LINKED   when applicable
CUSTOMER_REGISTRATION_ACTIVE
REGISTER_CUSTOMER_FAILED      when terminal failure occurs
```

Each audit event should contain identifiers and classifications, not unrestricted request bodies.

Minimum envelope:

- `eventId`;
- `eventType`;
- `occurredAt`;
- `businessSlug`;
- `workflowId`;
- `correlationId`;
- `customerId` when known;
- activity/phase classification;
- attempt number when relevant;
- sanitized metadata;
- sanitized failure classification when relevant.

---

## 6. Retry semantics

### Transient examples

Potentially retryable:

- temporary MongoDB connectivity failure;
- temporary attachment-store lock/unavailability;
- process crash during Activity execution;
- network interruption between worker and MongoDB.

### Permanent examples

Normally not retryable without command change:

- invalid command schema;
- expired/invalid attachment ingress reference;
- attachment hash mismatch;
- idempotency key conflict with different fingerprint;
- explicit business-policy rejection.

### Rule

Retry classification belongs to the Activity error taxonomy, not to string matching in the Workflow.

---

## 7. Idempotent Activity requirements

Temporal may retry an Activity after the Activity performed its side effect but before completion was recorded.

Therefore:

### Customer creation

Must not implement:

```text
insert every attempt
```

It needs a stable uniqueness key derived from registration/workflow identity.

### Attachment commit

Must not produce a new physical attachment for every retry.

It should use one or more stable identities:

- ingress identity;
- content hash;
- workflow/customer linkage identity.

### Audit append

If an audit milestone can be retried, it needs a stable event/deduplication identity so one conceptual milestone is not recorded repeatedly as distinct truth unless attempts are intentionally modeled separately.

---

## 8. Cross-store consistency strategy

MongoDB customer storage and the local attachment store do not share an atomic transaction.

mk0 uses **workflow-mediated consistency**, not a pretend distributed transaction.

### Rule

A Customer is not finalized as successful until:

1. the customer base exists;
2. every requested attachment has a committed local identity;
3. MongoDB contains the expected attachment references;
4. finalization checks pass.

If an attachment Activity fails transiently, Temporal retries.

If it fails permanently:

- workflow becomes failed;
- base customer/registration identity is retained for traceability/idempotency;
- it must not be presented as a successful completed registration;
- committed orphan candidates must be discoverable for cleanup/reconciliation.

Deletion-based rollback is not the default because deleting durable evidence can make retries and diagnosis less reliable.

---

## 9. Workflow query contract

The API must be able to obtain a safe projection with:

- workflow status;
- current mk0 phase;
- `customerId` if assigned;
- attachment count committed/requested;
- start/completion timestamps;
- typed failure classification;
- correlation ID.

It must not expose raw Temporal Event History directly to ordinary API callers.

---

## 10. Cancellation

mk0 does not expose arbitrary cancellation as the first CTA capability.

Reason:

Customer registration is short and cancellation adds ambiguous partial-persistence semantics.

A later design may add cancellation only after defining:

- allowed phases;
- attachment cleanup behavior;
- customer-base status;
- audit requirements.

---

## 11. Workflow versioning

The first implementation must treat Workflow behavior as versioned contract.

At minimum preserve:

- workflow type;
- command schema version;
- persistence schema version;
- golden dataset version.

Changes that alter replay behavior or sequencing require an explicit Temporal-compatible migration/versioning strategy before production histories exist.

---

## 12. Temporal gate

The Workflow design is accepted only if tests can prove:

- same command replay produces one customer;
- an Activity crash after side effect does not duplicate customer/attachment;
- worker restart resumes execution;
- transient persistence failure retries;
- permanent integrity error fails deterministically;
- no Workflow code calls MongoDB/local DB directly;
- workflow status remains queryable after failure;
- customer is not finalized before attachments are committed.
