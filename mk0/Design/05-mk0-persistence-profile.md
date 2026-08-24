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
├── workflow_context
├── attachment_ingress     optional
└── attachments            optional
```

**SQLite is removed from mk0.**

This profile realizes the third architecture zone using only PostgreSQL + MongoDB.

## 1. PostgreSQL role

PostgreSQL is the primary business database for `RegisterNewCustomer`.

It preserves transactional authority for:

- one canonical Customer registration;
- Customer business/contact/document fields from the approved contract;
- registration state/version;
- idempotency command receipt;
- final opaque references to optional attachment/document objects.

A future relational mapping may use tables such as:

```text
customers
customer_contacts
customer_phones
customer_documents
registration_commands
customer_attachment_refs
```

These are conceptual names only. No schema/DDL is authorized yet.

## 2. MongoDB role

MongoDB is the document-oriented persistence side of mk0.

It preserves:

- application execution audit;
- workflow/application context documents;
- optional attachment ingress objects;
- optional committed attachment/document objects;
- document integrity/lifecycle metadata.

MongoDB must not become a shadow copy of the canonical PostgreSQL Customer record.

## 3. Attachment data plane

When attachments exist, large binary content should not be carried as normal Temporal Workflow history payloads.

Conceptual flow:

```text
Postman binary upload
→ NestJS attachment ingress
→ MongoDB attachment_ingress / STAGED
→ ingressRef
→ RegisterNewCustomer command
→ Temporal
→ commitAttachment Activity
→ MongoDB attachment / COMMITTED
→ attachmentId + hash
→ PostgreSQL customer_attachment_ref
```

The staging write is technical ingress persistence only. It does not finalize a Customer attachment.

## 4. PostgreSQL registration identity

The authoritative idempotency relation conceptually contains:

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

This identity must remain stable across client and Temporal Activity retries.

## 5. MongoDB audit profile

Conceptual collection:

`execution_audit`

Event identity and correlation fields include:

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

The collection is optimized for execution/audit queries. It is not Customer truth and does not replace Temporal Event History.

## 6. MongoDB attachment/document profile

Exact MongoDB binary implementation remains a Build-time decision. Design requires the capability to support:

- STAGED ingress;
- opaque ingress identity;
- server-computed integrity metadata;
- COMMITTED attachment/document identity;
- idempotent retry;
- content retrieval/streaming;
- TTL/expiration for unclaimed staged objects;
- orphan/reconciliation discovery.

Possible physical choices such as GridFS must be evaluated later and are not frozen by this document.

## 7. PostgreSQL attachment reference profile

The canonical business record persists only a safe reference such as:

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

This keeps business relation/integrity facts in PostgreSQL while the document object remains in MongoDB.

## 8. Cross-store crash windows

### PostgreSQL Customer persisted; Activity acknowledgement lost

Retry resolves the existing Customer via registration identity.

### MongoDB attachment committed; Activity acknowledgement lost

Retry resolves the existing logical attachment via ingress/commit identity.

### MongoDB attachment committed; PostgreSQL reference missing

Temporal retries the PostgreSQL link using the existing opaque attachment ID.

### PostgreSQL reference exists; final workflow acknowledgement lost

Finalization is idempotent and returns the existing successful state when all preconditions are already satisfied.

### MongoDB audit temporarily unavailable

Retry behavior follows the explicit mandatory/diagnostic audit policy. Required milestones cannot silently disappear.

## 9. Temporal infrastructure isolation

A Temporal server may independently use PostgreSQL for its own persistence.

The topology must distinguish:

```text
postgres/application
  Customer + registration authority

postgres/temporal-internal
  Temporal cluster metadata/history persistence
```

Separate logical schemas/databases/credentials are required by architecture even if both live on the same PostgreSQL instance during local development.

## 10. Decision status

**FROZEN FOR mk0 DESIGN**

- CTA: Postman through NestJS.
- Orchestration: Temporal.
- Business persistence: PostgreSQL.
- Audit/context/documents: MongoDB.
- SQLite: removed.
- Services/Scheduler/Integration/Agent: outside first mk0 slice.

Exact libraries, drivers/ORM/ODM, MongoDB attachment mechanism, migrations, database names, credentials, limits and deployment configuration are Build decisions and are not selected yet.
