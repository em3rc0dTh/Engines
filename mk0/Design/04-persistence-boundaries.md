# 04 — Persistence Boundaries

## 1. Persistence scope

mk0 uses exactly two application persistence technologies:

```text
Persistence
├── PostgreSQL
│   ├── Customer business truth
│   ├── registration state
│   ├── idempotency/command receipt
│   └── attachment/document references
│
└── MongoDB
    ├── execution audit
    ├── workflow/application context
    └── optional attachment/document persistence
```

SQLite is **not** part of mk0.

## 2. PostgreSQL — canonical Customer authority

Authority question:

> What Customer was registered and what is the authoritative transactional state of that registration?

The relational model must represent the approved TimeSlots Customer semantics without forcing the entire canonical model into a single JSON blob.

Conceptual logical relations:

```text
customers
customer_contacts
customer_phones
customer_documents
registration_commands
customer_attachment_refs
```

These names are design-level placeholders, not DDL.

### PostgreSQL owns

- Customer stable ID;
- `businessSlug` ownership/partitioning field;
- Customer type/name/status;
- document/contact data required by the approved contract;
- registration lifecycle/version metadata;
- command/idempotency receipt;
- opaque references to optional MongoDB-persisted attachments/documents;
- transactional created/updated timestamps.

### PostgreSQL does not own

- full Temporal Event History;
- application log stream;
- unrestricted workflow context documents;
- raw attachment/document binary payloads in mk0.

## 3. Registration/idempotency authority — PostgreSQL

Conceptual registration command fields:

```text
operation
business_slug
idempotency_key_hash
command_fingerprint
workflow_id
customer_id nullable until assigned
status
created_at
updated_at
```

Required logical uniqueness:

```text
(operation, business_slug, idempotency_key_hash)
```

Rules:

- same key + same fingerprint → recover the same logical workflow/outcome;
- same key + different fingerprint → conflict;
- raw idempotency key need not be stored;
- phone/email/document equality is not a substitute for request idempotency.

## 4. MongoDB — execution/audit/context authority

MongoDB answers:

> What application execution evidence/context exists around this workflow?

Conceptual collections:

```text
execution_audit
workflow_context
attachment_ingress     optional
attachments            optional
```

### `execution_audit`

Append-oriented application milestones such as:

```text
REGISTER_CUSTOMER_ACCEPTED
REGISTER_CUSTOMER_VALIDATED
IDEMPOTENCY_RESERVED
CUSTOMER_BASE_PERSISTED
ATTACHMENT_COMMITTED
CUSTOMER_ATTACHMENTS_LINKED
CUSTOMER_REGISTRATION_ACTIVE
REGISTER_CUSTOMER_FAILED
```

Minimum event envelope:

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

This is an application audit projection, not a verbatim duplicate of Temporal history.

### PII rule

Do not log unrestricted request bodies. Prefer identifiers, classifications, counts, hashes and safe state metadata.

## 5. Optional attachments/documents — MongoDB capability

When an mk0 registration includes attachments, MongoDB provides the document/attachment persistence boundary.

Design intentionally does **not** freeze GridFS versus another MongoDB-backed binary/document representation yet. That is a Build-time implementation choice.

The contract requires:

```text
stage ingress
resolve ingress
commit idempotently
read metadata
verify integrity
retrieve/stream content
mark orphan/reconciliation state
expire unused staged ingress
```

A committed attachment/document exposes an opaque `attachmentId` plus safe metadata:

```text
attachmentId
sha256
byteLength
mediaType
originalFileName?
createdAt
storageState
```

The API never exposes MongoDB collection internals or storage-engine-specific identifiers as public semantics.

## 6. PostgreSQL attachment reference

PostgreSQL stores only the business link/reference:

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

No binary content is copied into the Customer relational row/table merely to simplify implementation.

## 7. Attachment lifecycle

```text
INGRESS / STAGED IN MONGODB
          ↓
COMMITTED IN MONGODB
          ↓
REFERENCED BY POSTGRESQL CUSTOMER/REGISTRATION
```

A staged object is not yet a committed Customer attachment.

## 8. Cross-store consistency

PostgreSQL and MongoDB do not share an atomic application transaction.

Temporal coordinates the saga-like progression.

### No attachments

```text
PostgreSQL command receipt
→ PostgreSQL Customer base
→ MongoDB audit milestone(s)
→ PostgreSQL finalization
```

### With attachments

```text
PostgreSQL command receipt
→ PostgreSQL Customer base
→ MongoDB attachment commit(s)
→ PostgreSQL attachment reference(s)
→ MongoDB audit/context milestones
→ PostgreSQL finalization
```

### Failure windows

**PostgreSQL Customer write succeeds, Activity completion is lost**

Retry must recover the same Customer; no duplicate insert.

**MongoDB attachment commits, Activity completion is lost**

Retry must recover the same logical attachment.

**MongoDB attachment commits, PostgreSQL reference fails**

Temporal retries the reference step using the existing attachment ID.

**PostgreSQL reference succeeds, workflow completion is lost**

Finalization must be idempotent.

**Permanent attachment failure**

Customer registration is not reported as successfully finalized; partial document evidence remains discoverable for reconciliation.

## 9. Temporal internal persistence is not application persistence

Temporal may itself use PostgreSQL or another database internally.

That storage belongs to Temporal infrastructure and must use separate schemas/databases/credentials from the Engines application persistence.

Never query/update Temporal internal tables to infer or mutate Customer business truth.

## 10. Design-level indexes/invariants

### PostgreSQL

- unique Customer primary key;
- indexed/partitionable `businessSlug` as required by final tenancy design;
- unique registration idempotency key tuple;
- unique logical Customer-attachment reference per attachment/customer relation;
- contact indexes only after duplicate/search policy is approved.

### MongoDB audit

Support queries by:

- `(businessSlug, workflowId, occurredAt)`;
- `(businessSlug, correlationId, occurredAt)`;
- `(businessSlug, customerId, occurredAt)`.

### MongoDB attachment capability

Stable ingress/attachment identity must prevent retry-induced logical duplication.

## 11. Failure taxonomy

At minimum:

```text
POSTGRES_CUSTOMER_STORE_UNAVAILABLE
POSTGRES_CUSTOMER_WRITE_CONFLICT
IDEMPOTENCY_CONFLICT
MONGO_AUDIT_STORE_UNAVAILABLE
MONGO_CONTEXT_STORE_UNAVAILABLE
ATTACHMENT_INGRESS_NOT_FOUND
ATTACHMENT_INGRESS_EXPIRED
ATTACHMENT_STORE_UNAVAILABLE
ATTACHMENT_INTEGRITY_MISMATCH
ATTACHMENT_COMMIT_CONFLICT
CUSTOMER_ATTACHMENT_LINK_FAILED
FINALIZATION_PRECONDITION_FAILED
```

## 12. Persistence gate

Persistence design is accepted when these answers remain unambiguous:

1. Customer truth → PostgreSQL.
2. Registration/idempotency truth → PostgreSQL.
3. Application audit/context → MongoDB.
4. Optional document/attachment persistence → MongoDB capability.
5. Customer attachment reference → PostgreSQL.
6. Workflow history → Temporal, not MongoDB.
7. Cross-store coordination → Temporal workflow/Activities.
8. Retry-safe Customer identity → registration/command identity.
9. Retry-safe attachment identity → ingress/commit identity.
10. No false success after permanent mandatory persistence failure.
11. No unrestricted PII/raw request duplication in audit.
12. No Services/Scheduler persistence is introduced in this mk0 slice.
