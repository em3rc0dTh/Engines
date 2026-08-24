# 04 — Persistence Boundaries

## 1. Persistence is not one database

mk0 intentionally separates three persistence concerns:

```text
Persistence
├── Customer business data
│   └── MongoDB
├── Workflow / audit application log
│   └── MongoDB
└── Attachment binary content
    └── separate local attachment database/store
```

The separation is semantic first and technological second.

---

## 2. Customer business store — MongoDB

### Authority

The Customer store answers:

> What is the canonical business state of this registered customer?

### Proposed collection

`customers`

Final naming can change during Build, but its authority cannot.

### Canonical fields from the TimeSlots data-model baseline

Conceptual Customer shape:

```text
Customer
├── _id
├── businessSlug
├── type
├── name
├── document
├── contact
│   ├── phones[]
│   └── email
├── whatsapp              optional/future channel metadata
├── metrics               business-derived metrics, not workflow logs
├── notes
├── status
├── createdAt
└── updatedAt
```

mk0 should not populate fields it does not know merely to make the document look complete.

### Registration metadata

Persistence may additionally need technical metadata such as:

- registration command/workflow identity;
- schema version;
- attachment references;
- optimistic/concurrency version.

Technical metadata must be clearly namespaced or modeled so it is not confused with customer-facing business facts.

---

## 3. Execution/Audit log — MongoDB

### Authority

The audit store answers:

> Which important application/business execution events occurred, for which workflow/customer, and with what outcome?

It is not the canonical Customer state and it is not a copy of Temporal Event History.

### Proposed collection

`execution_audit`

### Event characteristics

- append-oriented;
- immutable after commit except explicit retention/redaction operations;
- stable `eventId`;
- queryable by business/workflow/correlation/customer;
- sanitized;
- schema-versioned.

### Proposed event shape

```json
{
  "eventId": "evt_01...",
  "schemaVersion": "mk0.audit.v1",
  "eventType": "CUSTOMER_BASE_PERSISTED",
  "businessSlug": "example-business",
  "workflowId": "register-customer:...",
  "correlationId": "corr_01...",
  "customerId": "cus_01...",
  "phase": "PERSISTING_CUSTOMER_BASE",
  "attempt": 1,
  "occurredAt": "...",
  "metadata": {
    "attachmentCount": 0
  },
  "failure": null
}
```

### PII policy

Do not log the entire request/customer document by default.

Prefer:

- IDs;
- event classifications;
- counts;
- hashes/fingerprints where useful;
- safe status metadata.

Raw DNI/document numbers, full phone lists, full emails, attachment bytes, secrets, auth tokens, and database connection details should not be duplicated into routine audit events.

---

## 4. Command idempotency receipt — MongoDB

Idempotency requires durable comparison across API/client retries.

This may be a dedicated collection or a clearly separated document family.

Proposed concept:

`command_receipts`

Minimum fields:

```text
operation
businessSlug
idempotencyKeyHash
commandFingerprint
workflowId
customerId?       once known
status
createdAt
updatedAt
```

Required uniqueness:

```text
(operation, businessSlug, idempotencyKeyHash)
```

Rules:

- same key hash + same fingerprint → same workflow/outcome;
- same key hash + different fingerprint → conflict;
- raw idempotency key is not required to be stored.

Temporal Workflow ID uniqueness and command receipts should reinforce one another; neither should rely on customer phone uniqueness as idempotency.

---

## 5. Attachment store — local database/store

### Authority

The attachment store answers:

> Which exact binary object was committed and can it be retrieved with integrity?

### Technology

**Not selected in Design.**

Build must choose a local technology that satisfies the following contract instead of choosing a database first and adapting semantics around it.

### Required capability contract

Conceptual operations:

```text
stage/resolve ingress
commit attachment idempotently
read metadata
open/read content
verify integrity
mark/reconcile orphan candidate
delete only by explicit retention/cleanup policy
```

### Committed attachment metadata

Minimum:

```text
attachmentId
sha256
byteLength
mediaType
originalFileName?      display metadata only
createdAt
storageState
```

### Forbidden public contract

Never expose:

- physical path;
- local database page/row location;
- host-specific absolute directory;
- storage-engine internal key that would prevent future migration.

Expose only opaque `attachmentId`.

---

## 6. Customer attachment references

MongoDB should store references/metadata sufficient for business traversal.

Conceptual reference:

```json
{
  "attachmentId": "att_01...",
  "kind": "identity_document",
  "displayName": "DNI front",
  "mediaType": "image/jpeg",
  "byteLength": 184233,
  "sha256": "...",
  "committedAt": "..."
}
```

No bytes.

No local path.

---

## 7. Attachment ingress lifecycle

Because large binary payloads should not become Temporal Workflow payload/history, mk0 distinguishes:

```text
INGRESS/STAGED
      ↓
COMMITTED
      ↓
REFERENCED BY CUSTOMER
```

### STAGED

- accepted temporarily by the API ingress mechanism;
- has `ingressRef` and hash;
- not yet canonical business evidence;
- subject to TTL/cleanup if no workflow commits it.

### COMMITTED

- persisted in the local attachment store;
- stable `attachmentId`;
- integrity metadata verified.

### REFERENCED

- Customer document contains the committed reference.

A cleanup/reconciliation job may later remove expired staged data and true orphaned committed data, but not as an implicit side effect of a random API retry.

---

## 8. Consistency model

There is no distributed transaction across MongoDB and the local attachment database/store.

Therefore mk0 uses a saga-like workflow state.

### Successful no-attachment path

```text
idempotency receipt
→ customer base
→ finalization
→ ACTIVE
```

### Successful attachment path

```text
idempotency receipt
→ customer base/registration identity
→ commit attachment(s)
→ link references in MongoDB
→ verify expected count/hashes
→ finalization
→ ACTIVE
```

### Failure during attachment commit

```text
customer base exists
attachment N fails permanently
→ workflow FAILED
→ customer must not be exposed as completed ACTIVE registration
→ durable references allow retry/reconciliation
```

### Failure after attachment commit but before Mongo link

Retry must discover the same committed attachment and link it; it must not create a second copy solely because the prior Activity completion was lost.

### Failure after Mongo link but before workflow completion

Retry finalization must be idempotent and return the existing result.

---

## 9. Suggested indexes/invariants — design level

### Customer

- unique `_id`.
- indexed `businessSlug`.
- query indexes for normalized contact fields only after duplicate/business lookup policy is frozen.
- no automatic unique phone constraint in generic mk0 without an explicit business rule.

### Audit

Indexes supporting:

- `(businessSlug, workflowId, occurredAt)`;
- `(businessSlug, correlationId, occurredAt)`;
- `(businessSlug, customerId, occurredAt)`.

### Command receipts

Unique:

- `(operation, businessSlug, idempotencyKeyHash)`.

### Attachment references

Within one customer registration, the same committed `attachmentId` must not be linked twice accidentally.

---

## 10. Persistence failure taxonomy

Typed categories should include at least:

```text
CUSTOMER_STORE_UNAVAILABLE
CUSTOMER_WRITE_CONFLICT
IDEMPOTENCY_CONFLICT
AUDIT_STORE_UNAVAILABLE
ATTACHMENT_INGRESS_NOT_FOUND
ATTACHMENT_INGRESS_EXPIRED
ATTACHMENT_STORE_UNAVAILABLE
ATTACHMENT_INTEGRITY_MISMATCH
ATTACHMENT_COMMIT_CONFLICT
CUSTOMER_ATTACHMENT_LINK_FAILED
FINALIZATION_PRECONDITION_FAILED
```

Build may refine names, but it must not collapse all failures to `500 database error`.

---

## 11. Persistence gate

Persistence design is accepted when we can answer all of these without implementation-specific hand waving:

1. Where is Customer truth?
2. Where is audit truth?
3. Where are binary attachments?
4. What identifier crosses store boundaries?
5. How is attachment integrity verified?
6. How does retry avoid duplicate customers?
7. How does retry avoid duplicate attachments?
8. What happens if local attachment persistence succeeds but Mongo linking fails?
9. What happens if Mongo customer persistence succeeds but attachment persistence fails?
10. How are staged/orphaned attachments discovered later?
11. What data is forbidden from normal audit logs?
12. Can we migrate the local attachment technology without changing the public API?

mk0 answers these semantically before selecting the local database technology.
