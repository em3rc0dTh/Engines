# 05 — mk0 Physical Persistence Profile

## Decision

For the first stable mk0 application persistence profile:

```text
PostgreSQL
├── Customer business data
├── registration/idempotency state
└── attachment/document references

MongoDB
├── execution_audit
└── workflow_context

AttachmentStore     optional, only when attachments exist
├── attachment_ingress
└── committed attachment/document objects
```

The first two technologies are frozen for mk0:

- PostgreSQL for canonical Customer/registration business truth;
- MongoDB for application execution/audit/workflow context.

The physical `AttachmentStore` technology is intentionally **open until Build**.

## 1. PostgreSQL role

PostgreSQL is the primary business database for `RegisterNewCustomer`.

It preserves transactional authority for:

- one canonical Customer registration;
- Customer business/contact/document fields from the approved TimeSlots contract;
- registration state/version;
- business-scoped idempotency command receipt;
- normalized material initial-start fingerprint / replay-conflict evidence;
- final opaque references to optional attachments/documents.

Possible conceptual relations:

```text
customers
customer_contacts
customer_phones
customer_documents
registration_commands
customer_attachment_refs
```

These are design names only. No DDL is authorized yet.

## 2. MongoDB role

MongoDB preserves application execution evidence and workflow context:

```text
execution_audit
workflow_context
```

It must not become a shadow copy of the canonical PostgreSQL Customer.

Canonical success-gating logical audit milestones are:

```text
REGISTRATION_SESSION_STARTED
REGISTRATION_POLICY_LOADED
REQUIRED_DATA_REQUESTED          when applicable
CUSTOMER_DATA_ACCEPTED           per logically accepted external input
DUPLICATE_CHECK_COMPLETED
EXISTING_CUSTOMER_RESOLVED       for ALREADY_EXISTS
CUSTOMER_CREATED                 for CREATED
ATTACHMENT_COMMITTED             when applicable
REGISTRATION_COMPLETED
```

Additional diagnostic events may contain:

- workflow/correlation/customer IDs;
- phase/milestone classifications;
- Activity attempt/outcome metadata where useful;
- sanitized failure classifications;
- safe counts/hashes/context required for diagnosis.

A registration cannot be reported successful while an applicable success-gating logical audit milestone is missing.

## 3. AttachmentStore role

When attachments are present, mk0 uses a separate attachment persistence contract.

Required capabilities:

- stage ingress;
- return opaque `ingressRef`;
- commit one stable logical object;
- return opaque `attachmentId`;
- preserve SHA-256/length/media type metadata;
- retrieve/stream content;
- retry idempotently;
- expire unused staged objects;
- expose orphan/reconciliation candidates.

Potential Build technologies include, but are not limited to:

- MongoDB GridFS;
- object/file storage with metadata persistence;
- another local database designed for binary objects.

No option is selected by Design yet.

## 4. Attachment data plane

Large binary content should not be carried as normal Temporal Workflow-history payloads.

Conceptual flow:

```text
CTA attachment input
→ AttachmentStore ingress / STAGED
→ opaque ingressRef
→ RegisterNewCustomer command
→ Temporal
→ commitAttachment Activity
→ AttachmentStore / COMMITTED
→ attachmentId + integrity metadata
→ PostgreSQL customer_attachment_ref
```

A staged object is technical ingress only. It cannot finalize Customer registration.

## 5. PostgreSQL registration identity

Conceptual idempotency relation:

```text
operation
business_slug
idempotency_key_hash
command_fingerprint
workflow_id
customer_id
status
created_at
updated_at
```

Logical unique key:

```text
(operation, business_slug, idempotency_key_hash)
```

The same opaque key under a different `business_slug` does not collide solely on key text.

`command_fingerprint` represents the normalized material **initial start snapshot**, including conceptually:

```text
operation
businessSlug
schemaVersion
normalized initial Customer draft
normalized initial attachment ingress identities / expected integrity metadata
```

Exact replay with the same business-scoped identity + same fingerprint resolves the same logical session.

Same business-scoped identity + materially different initial fingerprint produces:

```text
SESSION_IDEMPOTENCY_CONFLICT
```

Later `ProvideCustomerData` Updates do not rewrite the original start fingerprint.

## 6. MongoDB audit profile

Conceptual `execution_audit` event:

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

- stable conceptual/logical event identity;
- queryable by workflow/correlation/customer;
- retry-safe success-gating milestone representation;
- no unrestricted request-body duplication;
- no attachment binary payloads in routine audit;
- no secrets/credentials;
- no role as canonical Customer truth.

If required audit remains unavailable after the frozen retry policy is exhausted:

```text
failureCode = MONGO_AUDIT_STORE_UNAVAILABLE
successful registration outcome = forbidden
```

Temporal Event History remains the durable orchestration evidence for that failure.

## 7. PostgreSQL attachment reference profile

Conceptual relation:

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

This keeps business linkage and integrity evidence near Customer truth while storage internals stay behind `AttachmentStore`.

## 8. Cross-store crash windows

### PostgreSQL Customer persisted; acknowledgement lost

Retry resolves the existing Customer through registration identity.

### Attachment committed; Activity acknowledgement lost

Retry resolves the same logical attachment through ingress/commit identity.

### Attachment committed; PostgreSQL reference missing

Temporal retries the PostgreSQL link with the same opaque attachment ID.

### Required MongoDB audit milestone persisted; acknowledgement lost

Retry resolves/reuses the same logical milestone identity rather than producing uncontrolled duplicates.

### PostgreSQL reference/audit exists; final acknowledgement lost

Finalization is idempotent and recognizes already-satisfied preconditions.

### MongoDB audit/context temporarily unavailable

Required milestones retry according to explicit policy. Diagnostic-only detail must not create uncontrolled workflow failure.

### MongoDB required audit unavailable after retry exhaustion

No successful `CREATED` or successful `ALREADY_EXISTS` result is allowed. Temporal exposes typed failure state.

## 9. Temporal infrastructure isolation

Temporal may independently use PostgreSQL, Cassandra or another backend for its own runtime persistence.

Architecture keeps this separate:

```text
application/postgresql
  Customer + registration authority

application/mongodb
  audit + workflow context

application/attachment-store
  optional binary/document objects

temporal/internal-persistence
  Temporal-owned runtime state
```

No application business logic depends on Temporal internal DB tables.

## 10. Decision status

**FROZEN FOR mk0 DESIGN**

- CTA: Postman/CLI/minimal test harness; no framework required.
- Orchestration: Temporal.
- Customer/registration persistence: PostgreSQL.
- Registration idempotency: business-scoped tuple + deterministic initial-start fingerprint.
- Audit/workflow context: MongoDB with explicit success-gating logical milestones.
- Attachments: separate `AttachmentStore` contract; physical technology open until Build.
- SQLite: not preselected.
- NestJS/application framework: not part of mk0 architecture baseline.
- Services/Scheduler/Integration/Agent: outside first mk0 slice.

Exact drivers, ORM/ODM, database names, migrations, credentials, attachment technology, limits and deployment topology are Build decisions.

Complete production PII retention/encryption/backup policy is a later production gate. mk0 continues to use synthetic fixtures and forbids unrestricted real Customer PII in test/audit data.
