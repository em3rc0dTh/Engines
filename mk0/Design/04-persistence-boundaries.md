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
- business-scoped command/idempotency receipt;
- normalized initial-start fingerprint or equivalent comparison evidence;
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

The same opaque idempotency key text under a different `business_slug` is a different business-scoped identity.

The deterministic `command_fingerprint` represents the normalized material **initial start snapshot**, conceptually including:

```text
operation
businessSlug
schemaVersion
normalized initial Customer draft
normalized initial attachment ingress identities / expected integrity metadata
```

It excludes correlation/presentation/timestamp metadata that does not change business meaning.

Rules:

- same business-scoped identity + same initial fingerprint → same logical Workflow/session/outcome;
- same business-scoped identity + materially different initial fingerprint → `SESSION_IDEMPOTENCY_CONFLICT`;
- later `ProvideCustomerData` Updates do not rewrite the original initial-start fingerprint;
- raw key need not be persisted;
- phone/email/document equality is natural duplicate policy, not request/session idempotency.

## 4. MongoDB — execution/audit/context authority

MongoDB answers:

> What application execution evidence and workflow context exists around this registration?

Conceptual collections:

```text
execution_audit
workflow_context
```

### `execution_audit`

Canonical success-gating logical milestones for mk0:

```text
REGISTRATION_SESSION_STARTED
REGISTRATION_POLICY_LOADED
REQUIRED_DATA_REQUESTED          when the Workflow waits for policy-required data
CUSTOMER_DATA_ACCEPTED           once per logically accepted external input
DUPLICATE_CHECK_COMPLETED
EXISTING_CUSTOMER_RESOLVED       for ALREADY_EXISTS
CUSTOMER_CREATED                 for CREATED
ATTACHMENT_COMMITTED             when applicable
REGISTRATION_COMPLETED
```

`REGISTRATION_FAILED` is recorded when the audit store is available and the Workflow fails. It cannot be a prerequisite for truthfully exposing a failure caused by MongoDB itself being unavailable.

Additional diagnostic events are allowed, for example classified validation rejection, retry-attempt metadata, persistence/link milestones or timings, but those do not independently define successful business completion.

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

Required properties:

- stable logical event identity;
- retry-safe representation;
- queryability by Workflow/correlation/customer where applicable;
- no unrestricted request-body or binary duplication;
- no role as PostgreSQL Customer truth;
- no role as a verbatim replacement for Temporal Event History.

### Success-gating rule

A registration may not be reported as successful `CREATED` or successful `ALREADY_EXISTS` until all applicable required logical audit milestones have been durably represented.

If MongoDB remains unavailable after the frozen retry/failure policy is exhausted:

```text
failureCode = MONGO_AUDIT_STORE_UNAVAILABLE
successful registration outcome = forbidden
```

Temporal Event History remains the durable orchestration evidence for the failure.

### PII rule

Do not persist unrestricted request bodies in audit/context. Prefer IDs, classifications, field names, counts, hashes and safe state metadata.

mk0 Golden/Test data is synthetic. Complete production retention/encryption policy is a later production gate and does not authorize real Customer PII in mk0 fixtures.

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

### New Customer without attachments

```text
PostgreSQL command receipt / start fingerprint
→ PostgreSQL Customer base
→ MongoDB required audit/context
→ PostgreSQL registration finalization
→ successful CREATED result
```

### New Customer with attachments

```text
PostgreSQL command receipt / start fingerprint
→ PostgreSQL Customer base
→ AttachmentStore commit(s)
→ PostgreSQL attachment reference(s)
→ MongoDB required audit/context
→ PostgreSQL registration finalization
→ successful CREATED result
```

### Existing Customer / hard duplicate

```text
PostgreSQL command receipt / start fingerprint
→ PostgreSQL duplicate lookup resolves existing Customer
→ MongoDB DUPLICATE_CHECK_COMPLETED + EXISTING_CUSTOMER_RESOLVED + required audit
→ PostgreSQL registration finalization
→ successful ALREADY_EXISTS result
```

No second Customer is created on the existing-Customer path.

### Failure windows

**PostgreSQL Customer write succeeds; Activity acknowledgement lost**

Retry resolves the same Customer via registration identity.

**AttachmentStore commit succeeds; Activity acknowledgement lost**

Retry resolves the same logical attachment.

**AttachmentStore commit succeeds; PostgreSQL reference fails**

Temporal retries the reference using the same attachment ID.

**MongoDB required audit write succeeds; acknowledgement lost**

Retry resolves/reuses the same logical audit milestone identity rather than creating an unintended duplicate event.

**PostgreSQL reference/audit succeeds; Workflow/finalization acknowledgement lost**

Finalization remains idempotent and recognizes already-satisfied preconditions.

**Permanent attachment failure**

Customer registration is not reported successfully finalized; partial attachment state remains discoverable for reconciliation.

**MongoDB required audit temporarily unavailable**

Temporal retries according to Activity policy. Required evidence cannot silently disappear.

**MongoDB required audit permanently unavailable / retries exhausted**

Registration is not reported successful. Temporal exposes typed failure evidence; no false `REGISTRATION_COMPLETED` audit marker may be created.

## 9. Temporal internal persistence is separate

Temporal may use PostgreSQL or another database internally.

That persistence is infrastructure and must remain logically isolated from Engines application PostgreSQL/MongoDB/AttachmentStore data.

Never query/update Temporal internal tables as Customer business truth.

## 10. Design-level invariants

### PostgreSQL

- unique Customer primary key;
- unique business-scoped registration idempotency tuple;
- deterministic initial-start replay/conflict comparison;
- one logical Customer-attachment reference per intended relation;
- contact indexes only after duplicate/search policy is approved.

### MongoDB

- stable logical event identity for retry-safe milestones;
- required audit queryability by Workflow/correlation/customer where applicable;
- required success-gating milestones cannot be silently omitted;
- diagnostic event detail cannot redefine Customer or Workflow truth.

### AttachmentStore

Stable ingress/attachment identity must prevent retry-induced logical duplication and preserve integrity metadata.

## 11. Failure taxonomy

At minimum:

```text
POSTGRES_CUSTOMER_STORE_UNAVAILABLE
POSTGRES_CUSTOMER_WRITE_CONFLICT
SESSION_IDEMPOTENCY_CONFLICT
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
3. Session identity is business-scoped by `(operation, businessSlug, idempotencyKeyHash)`.
4. The material initial start snapshot has deterministic replay/conflict semantics.
5. Later Workflow Updates do not rewrite the original start fingerprint.
6. Application audit/context → MongoDB.
7. Canonical success-gating audit vocabulary and retry-safe logical identity are explicit.
8. Successful registration is impossible after exhausted mandatory-audit persistence failure.
9. Binary/document objects → AttachmentStore when present.
10. Attachment business reference → PostgreSQL.
11. Workflow history → Temporal.
12. Cross-store coordination → Temporal Workflow + Activities.
13. Retry-safe Customer identity → registration/command identity.
14. Retry-safe attachment identity → ingress/commit identity.
15. No false success after permanent mandatory persistence failure.
16. No unrestricted PII/raw request duplication in audit.
17. Attachment technology remains replaceable without changing command/workflow business semantics.
