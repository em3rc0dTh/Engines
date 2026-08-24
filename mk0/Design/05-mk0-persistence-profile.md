# 05 — mk0 Physical Persistence Profile

## Decision

For the first stable mk0 build, use:

```text
MongoDB
├── customers
├── command_receipts
└── execution_audit

SQLite (local)
├── attachment_ingress
└── attachments
```

This is the **mk0 physical profile**.

The architecture still depends on persistence contracts (`CustomerRepository`, `ExecutionAuditRepository`, `AttachmentStore`) rather than MongoDB/SQLite-specific APIs outside infrastructure.

---

## 1. Why MongoDB for customer + audit

The existing TimeSlots/DataModel ecosystem is document-oriented and already models Customer as a nested document with contact/document metadata.

MongoDB is therefore a natural first authority for:

- canonical Customer documents;
- command/idempotency receipts;
- application audit events.

These remain separate collections because they have different invariants and retention/query patterns.

---

## 2. Why SQLite for attachments in mk0

mk0 requires attachments in another **local database**.

SQLite is selected because the first stable slice benefits from:

- local embedded operation;
- no separate attachment-service process;
- transactional row state changes;
- BLOB support;
- deterministic metadata alongside content;
- easy integrity checks;
- straightforward backup/export for a small mk0 runtime;
- a clean migration boundary behind `AttachmentStore` later.

This is not a declaration that SQLite is the final production media store for every deployment scale.

---

## 3. Two-plane attachment flow

Large binary content should not be carried through Temporal Workflow history.

Therefore attachment ingress has a data plane that is separate from the durable business control plane.

### Control plane

```text
Postman
→ NestJS
→ Temporal RegisterNewCustomer
→ Activities
→ Persistence
```

### Binary data plane

```text
Postman binary upload
→ NestJS attachment-ingress endpoint
→ SQLite attachment_ingress (STAGED)
→ opaque ingressRef
```

The registration command then contains only `ingressRef` values.

Temporal Activities convert those staged rows into committed attachments.

This does not make NestJS the business orchestrator. NestJS only accepts/stages transport data; it cannot mark an attachment as a committed Customer attachment.

---

## 4. MongoDB logical collections

### `customers`

Authority: Customer business state.

Conceptual technical metadata in addition to canonical model fields:

```text
registration
  workflowId
  commandFingerprint
  schemaVersion

attachments[]
  attachmentId
  kind
  displayName
  mediaType
  byteLength
  sha256
  committedAt
```

No attachment bytes.

### `command_receipts`

Authority: API/business-command idempotency receipt.

Conceptual shape:

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

Unique logical key:

```text
(operation, businessSlug, idempotencyKeyHash)
```

### `execution_audit`

Authority: application-level audit projection.

Conceptual shape:

```text
eventId
eventType
schemaVersion
businessSlug
workflowId
correlationId
customerId?
phase
attempt?
occurredAt
metadata
failure?
```

---

## 5. SQLite `attachment_ingress`

Purpose: short-lived staged binary objects accepted at the HTTP edge.

Conceptual columns:

```text
ingress_id            opaque ID, primary key
state                 STAGED | CLAIMED | COMMITTED | EXPIRED | FAILED
sha256                expected/staged content hash
byte_length
media_type
original_file_name
content_blob
created_at
expires_at
claimed_by_workflow_id nullable
committed_attachment_id nullable
```

### Invariants

- an ingress row starts `STAGED`;
- `ingress_id` is opaque;
- hash is computed by the server, not trusted from caller alone;
- expired ingress cannot be newly claimed;
- one ingress object can be claimed by at most the intended registration semantics;
- transition to `COMMITTED` records the resulting stable attachment ID.

---

## 6. SQLite `attachments`

Purpose: canonical local committed attachment content.

Conceptual columns:

```text
attachment_id         opaque ID, primary key
sha256
byte_length
media_type
original_file_name
content_blob
storage_state         COMMITTED | CORRUPT | ORPHAN_CANDIDATE | DELETED
created_at
verified_at
```

Optional later metadata may include encryption/key/version fields, but mk0 must not invent security metadata it does not actually enforce.

### Invariants

- `COMMITTED` means content exists and hash verification passed;
- attachment ID is stable across Activity retry;
- public API never exposes the SQLite database path;
- Customer stores only the opaque ID + integrity/display metadata;
- an attachment that has been committed but not linked due to downstream failure remains discoverable.

---

## 7. Attachment commit algorithm — semantic contract

```text
1. Activity receives workflowId + customerId + ingressRef.
2. Load staged ingress row.
3. Validate not expired and allowed state.
4. Verify stored content hash/length.
5. Determine stable attachment identity.
6. If already committed for this ingress, return existing attachment metadata.
7. Otherwise commit attachment row transactionally in SQLite.
8. Mark ingress row COMMITTED with attachment ID.
9. Return attachment metadata to Workflow.
10. Workflow invokes Mongo link Activity.
```

No code is authorized yet; this sequence is the contract future code must satisfy.

---

## 8. Crash windows

### Crash after ingress stage

No workflow/customer yet.

Recovery:

- TTL cleanup later.

### Crash after workflow start but before attachment claim

Recovery:

- Temporal resumes;
- staged ingress still available.

### Crash after attachment row commit but before Activity result recorded

Recovery:

- retry sees ingress already mapped to committed attachment ID;
- returns same attachment;
- no duplicate logical content created by retry.

### Crash after attachment commit but before Mongo reference

Recovery:

- Temporal retries Mongo link;
- committed attachment is not lost;
- orphan reconciliation can detect if workflow becomes terminally failed.

### Crash after Mongo link but before final Workflow completion

Recovery:

- finalization is idempotent;
- existing attachment reference remains single.

---

## 9. SQLite is not customer authority

Do not put Customer data into `attachments.db` merely because it is convenient.

Allowed linkage data is minimal:

- workflow ID;
- ingress ID;
- attachment ID;
- technical integrity metadata.

Customer name, phone, document data, notes, business metrics, etc. remain in MongoDB.

---

## 10. Future migration rule

A future deployment may replace SQLite content storage with object storage or another database.

The migration is acceptable only if:

```text
AttachmentStore contract remains stable
opaque attachment IDs remain resolvable/migratable
Customer documents do not need API-contract changes
Workflow semantics do not depend on SQLite-specific SQL behavior
```

---

## 11. Decision status

**FROZEN FOR mk0 DESIGN**

- MongoDB: business + idempotency + audit collections.
- SQLite: local staged + committed attachment BLOB storage.
- abstraction boundary remains mandatory.

Exact Node libraries, SQLite driver, Mongo driver/ODM, migrations, limits, and connection configuration are Build decisions and are not selected here.
