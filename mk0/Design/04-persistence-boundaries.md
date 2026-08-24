# 04 — Persistence Boundaries

## 1. Persistence scope

mk0 freezes two required application databases and one optional separate attachment capability:

```text
Persistence
├── PostgreSQL
│   ├── Customer business truth
│   ├── registration state
│   ├── idempotency/command receipt
│   └── attachment/document references
│
├── MongoDB
│   ├── execution audit
│   └── workflow/application context
│
└── AttachmentStore        only when attachments exist
    ├── staged binary/document objects
    ├── committed binary/document objects
    └── integrity/lifecycle metadata
```

`AttachmentStore` physical technology is **not frozen yet**. It may later be implemented with MongoDB/GridFS, local/object storage, or another database/storage mechanism. The architectural contract is the important part.

## 2. PostgreSQL — canonical Customer authority

Authority question:

> What Customer was registered and what is the authoritative transactional state of that registration?

The relational model must represent the approved TimeSlots Customer semantics without forcing the canonical model into one opaque JSON blob.

Conceptual logical relations:

```text
customers
customer_contacts
customer_phones
customer_documents
registration_commands
customer_attachment_refs
```

These names are design placeholders, not DDL.

### PostgreSQL owns

- Customer stable ID;
- `businessSlug`;
- Customer type/name/status;
- approved document/contact data;
- registration lifecycle/version metadata;
- command/idempotency receipt;
- opaque attachment/document references;
- transactional timestamps.

### PostgreSQL does not own

- Temporal Event History;
- application log stream;
- unrestricted workflow context;
- raw attachment binaries merely for convenience.

## 3. Registration/idempotency authority — PostgreSQL

Conceptual fields:

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

Logical uniqueness:

```text
(operation, business_slug, idempotency_key_hash)
```

Rules:

- same key + same fingerprint → same logical workflow/outcome;
- same key + different fingerprint → conflict;
- raw key need not be persisted;
- phone/email/document equality is not request idempotency.

## 4. MongoDB — execution/audit/context authority

MongoDB answers:

> What application execution evidence and workflow context exists around this registration?

Conceptual collections:

```text
execution_audit
workflow_context
```

### `execution_audit`

Minimum conceptual milestones:

```text
REGISTER_CUSTOMER_ACCEPTED
REGISTER_CUSTOMER_VALIDATED
IDEMPOTENCY_RESERVED
CUSTOMER_BASE_PERSISTED
ATTACHMENT_COMMITTED          when applicable
CUSTOMER_ATTACHMENTS_LINKED   when applicable
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

MongoDB is an application audit/context projection. It is neither PostgreSQL Customer truth nor a verbatim copy of Temporal history.

### PII rule

Do not persist unrestricted request bodies in audit/context. Prefer IDs, classifications, counts, hashes and safe state metadata.

## 5. AttachmentStore — separate optional authority

When attachments exist, a separate capability owns the binary/document object lifecycle.

Required contract:

```text
stage ingress
resolve ingress
commit idempotently
read metadata
retrieve/stream content
verify integrity
expire unused staged ingress
mark/list orphan or reconciliation candidates
```

Committed safe metadata includes at least:

```text
attachmentId
sha256
byteLength
mediaType
originalFileName?
createdAt
storageState
```

The physical storage may be MongoDB/GridFS or another persistence technology, but callers and workflow logic only depend on `AttachmentStore` semantics.

## 6. PostgreSQL attachment reference

PostgreSQL stores the business link/reference, conceptually:

```text
customer_id
attachment_id
kind
display_name
media_type
byte_length
sha256
committed_at
```

No storage path or provider-specific internal identifier becomes business semantics.

## 7. Attachment lifecycle

```text
INGRESS / STAGED IN ATTACHMENT STORE
              ↓
COMMITTED IN ATTACHMENT STORE
              ↓
REFERENCED BY POSTGRESQL CUSTOMER/REGISTRATION
```

A staged object is not a committed Customer attachment.

## 8. Cross-store consistency

PostgreSQL, MongoDB and AttachmentStore do not share one application transaction.

Temporal coordinates the progression.

### No attachments

```text
PostgreSQL command receipt
→ PostgreSQL Customer base
→ MongoDB audit/context
→ PostgreSQL finalization
```

### With attachments

```text
PostgreSQL command receipt
→ PostgreSQL Customer base
→ AttachmentStore commit(s)
→ PostgreSQL attachment reference(s)
→ MongoDB audit/context
→ PostgreSQL finalization
```

### Failure windows

**PostgreSQL Customer write succeeds; Activity acknowledgement lost**

Retry resolves the same Customer via registration identity.

**AttachmentStore commit succeeds; Activity acknowledgement lost**

Retry resolves the same logical attachment.

**AttachmentStore commit succeeds; PostgreSQL reference fails**

Temporal retries the reference using the same attachment ID.

**PostgreSQL reference succeeds; workflow completion acknowledgement lost**

Finalization remains idempotent.

**Permanent attachment failure**

Customer registration is not reported successfully finalized; partial attachment state remains discoverable for reconciliation.

**MongoDB audit/context temporarily unavailable**

Retry/failure behavior follows the frozen mandatory-audit policy; required evidence cannot silently disappear.

## 9. Temporal internal persistence is separate

Temporal may use PostgreSQL or another database internally.

That persistence is infrastructure and must remain logically isolated from Engines application PostgreSQL/MongoDB/AttachmentStore data.

Never query/update Temporal internal tables as Customer business truth.

## 10. Design-level invariants

### PostgreSQL

- unique Customer primary key;
- unique registration idempotency tuple;
- one logical Customer-attachment reference per intended relation;
- contact indexes only after duplicate/search policy is approved.

### MongoDB

Support audit/context queries by workflow/correlation/customer and stable event identity for retry-safe milestones.

### AttachmentStore

Stable ingress/attachment identity must prevent retry-induced logical duplication and preserve integrity metadata.

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

Persistence Design is accepted when:

1. Customer truth → PostgreSQL.
2. Registration/idempotency truth → PostgreSQL.
3. Application audit/context → MongoDB.
4. Binary/document objects → AttachmentStore when present.
5. Attachment business reference → PostgreSQL.
6. Workflow history → Temporal.
7. Cross-store coordination → Temporal Workflow + Activities.
8. Retry-safe Customer identity → registration/command identity.
9. Retry-safe attachment identity → ingress/commit identity.
10. No false success after permanent mandatory persistence failure.
11. No unrestricted PII/raw request duplication in audit.
12. Attachment technology remains replaceable without changing command/workflow business semantics.
