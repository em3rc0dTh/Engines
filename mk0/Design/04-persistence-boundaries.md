# 04 — Persistence Boundaries

## 1. Persistence is not one database

mk0 separates three persistence authorities:

```text
Persistence
├── Customer business data
│   └── MongoDB
├── Workflow / audit application log
│   └── MongoDB
└── Attachment binary content
    └── SQLite local attachment database
```

The semantic boundary is primary. The mk0 physical profile is frozen in [`05-mk0-persistence-profile.md`](05-mk0-persistence-profile.md).

---

## 2. Customer business store — MongoDB

Authority question:

> What is the canonical business state of this registered customer?

Collection:

`customers`

Conceptual Customer shape inherited from the TimeSlots data-model baseline:

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

mk0 must not populate facts it does not know merely to make the document look complete.

Technical registration metadata may include:

- registration workflow identity;
- command fingerprint/schema version;
- attachment references;
- concurrency/version metadata.

Technical metadata must remain distinguishable from customer-facing facts.

---

## 3. Execution/Audit log — MongoDB

Authority question:

> Which important application/business execution events occurred, for which workflow/customer, and with what outcome?

Collection:

`execution_audit`

Characteristics:

- append-oriented;
- stable event identity;
- queryable by business/workflow/correlation/customer;
- sanitized;
- schema-versioned;
- not a copy of the Customer document;
- not a verbatim copy of Temporal Event History.

Conceptual event:

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
  "metadata": {"attachmentCount": 0},
  "failure": null
}
```

PII policy:

- do not log whole request bodies;
- prefer IDs, classifications, counts, hashes, and safe status metadata;
- do not routinely duplicate raw DNI/document values, complete phones/emails, attachment bytes, secrets, auth tokens, or connection details.

---

## 4. Command idempotency receipts — MongoDB

Collection:

`command_receipts`

Conceptual fields:

```text
operation
businessSlug
idempotencyKeyHash
commandFingerprint
workflowId
customerId?
status
createdAt
updatedAt
```

Required logical uniqueness:

```text
(operation, businessSlug, idempotencyKeyHash)
```

Rules:

- same key hash + same fingerprint → same workflow/outcome;
- same key hash + different fingerprint → conflict;
- raw key need not be stored;
- phone/email uniqueness is not an idempotency mechanism.

---

## 5. Attachment authority — SQLite

Authority question:

> Which exact binary object was staged/committed and can it be retrieved with integrity?

mk0 uses SQLite behind the `AttachmentStore` contract.

Conceptual capabilities:

```text
stage ingress
resolve ingress
commit attachment idempotently
read metadata
read/stream content
verify integrity
mark/reconcile orphan candidate
expire staged data
explicit cleanup/retention
```

Committed metadata includes at least:

```text
attachmentId
sha256
byteLength
mediaType
originalFileName?
createdAt
storageState
```

The public contract never exposes:

- physical SQLite path;
- host directory;
- page/row coordinates;
- migration-hostile internal storage keys.

Only opaque attachment identities cross the boundary.

---

## 6. Customer attachment references

MongoDB stores reference metadata, never binary content.

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

No BLOB.

No local path.

---

## 7. Attachment lifecycle

```text
INGRESS/STAGED
      ↓
COMMITTED IN SQLITE
      ↓
REFERENCED BY CUSTOMER IN MONGODB
```

### STAGED

- accepted at API data-plane ingress;
- has opaque `ingressRef` and server-computed integrity metadata;
- not yet a committed Customer attachment;
- expires if never claimed/committed.

### COMMITTED

- binary exists in SQLite `attachments`;
- stable `attachmentId` exists;
- integrity verification passed.

### REFERENCED

- Customer document contains the expected committed reference.

---

## 8. Consistency model

MongoDB and SQLite do not share one atomic transaction.

mk0 uses workflow-mediated/saga-like consistency.

### No-attachment success

```text
idempotency receipt
→ customer base
→ finalization
→ success
```

### Attachment success

```text
idempotency receipt
→ customer base/registration identity
→ commit attachment(s) in SQLite
→ link references in MongoDB
→ verify expected count/hashes
→ finalization
→ success
```

### Permanent failure during attachment commit

- workflow fails with typed outcome;
- base registration identity remains for traceability/idempotency;
- customer is not exposed as completed successful registration;
- committed orphan candidates remain discoverable.

### Attachment committed but Mongo link lost/fails

Retry discovers/reuses the same attachment and links it. It must not create a new logical attachment merely because an Activity completion was lost.

### Mongo link exists but final workflow completion is lost

Finalization retry must be idempotent and return the existing result.

---

## 9. Design-level indexes/invariants

### Customer

- unique `_id`;
- indexed `businessSlug`;
- normalized-contact indexes only after lookup/duplicate policy is frozen;
- no generic unique-phone assumption without explicit business rule.

### Audit

Support queries by:

- `(businessSlug, workflowId, occurredAt)`;
- `(businessSlug, correlationId, occurredAt)`;
- `(businessSlug, customerId, occurredAt)`.

### Command receipts

Unique:

- `(operation, businessSlug, idempotencyKeyHash)`.

### Customer attachment refs

One committed `attachmentId` must not be linked twice accidentally to the same registration.

---

## 10. Persistence failure taxonomy

At minimum:

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

Build can refine names but must not collapse every persistence failure to an undifferentiated database error.

---

## 11. Persistence gate

Persistence design is accepted when all answers are explicit:

1. Customer truth → MongoDB `customers`.
2. Idempotency receipt → MongoDB `command_receipts`.
3. Application audit → MongoDB `execution_audit`.
4. Binary attachments → SQLite.
5. Cross-store identity → opaque `attachmentId` plus hash metadata.
6. Retry-safe customer identity → workflow/command identity.
7. Retry-safe attachment identity → ingress/commit identity.
8. Mongo-link failure after SQLite commit → reuse and retry link.
9. Attachment failure after Customer base → no false successful finalization.
10. Staged/orphaned attachments → discoverable for TTL/reconciliation.
11. Routine audit logs → sanitized, no unrestricted PII/blobs.
12. Future store migration → possible behind `AttachmentStore` without public API change.
