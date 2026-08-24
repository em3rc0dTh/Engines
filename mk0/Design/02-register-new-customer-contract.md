# 02 — Register New Customer Contract

## 1. Command

Canonical command name:

`RegisterNewCustomer`

The HTTP API is a transport mapping of this command. The command contract must remain usable by Postman now and by future CTAs later.

---

## 2. HTTP endpoints for mk0

### 2.1 Stage an attachment — only when needed

`POST /api/mk0/attachments/stage`

Purpose:

- accept binary data at the HTTP edge;
- validate transport-level file constraints;
- create a short-lived opaque `ingressRef`;
- avoid putting large binary payloads inside Temporal Workflow input/history.

This is a **technical ingress operation**, not a committed customer attachment.

A staged attachment is not considered business-persisted until `RegisterNewCustomer` commits it through the persistence Activity.

Proposed response:

```json
{
  "ingressRef": "ing_01...",
  "fileName": "dni-front.jpg",
  "mediaType": "image/jpeg",
  "byteLength": 184233,
  "sha256": "...",
  "expiresAt": "..."
}
```

### 2.2 Register customer

`POST /api/mk0/customers/register`

Required header:

```text
Idempotency-Key: <caller-generated opaque key>
```

Optional caller correlation header:

```text
X-Correlation-Id: <caller value>
```

If absent, the server creates the correlation ID.

### 2.3 Query workflow

`GET /api/mk0/workflows/{workflowId}`

Purpose:

- inspect durable execution status;
- retrieve final customer identity or typed failure;
- make Postman sufficient as the first CTA.

### 2.4 Read resulting customer

`GET /api/mk0/customers/{customerId}`

This is a read-only verification endpoint for mk0. It must use the Customer read/application boundary and must not expose persistence implementation details.

---

## 3. Register request envelope

Proposed mk0 envelope:

```json
{
  "businessSlug": "example-business",
  "customer": {
    "type": "person",
    "name": "Ana Torres",
    "document": {
      "type": "DNI",
      "value": "12345678",
      "country": "PE"
    },
    "contact": {
      "phones": [
        {
          "label": "principal",
          "countryCode": "+51",
          "number": "955000111",
          "normalized": "51955000111",
          "isWhatsapp": true,
          "primary": true
        }
      ],
      "email": "ana@example.com"
    },
    "notes": "Optional business note"
  },
  "attachments": [
    {
      "ingressRef": "ing_01...",
      "kind": "identity_document",
      "displayName": "DNI front"
    }
  ]
}
```

### Data-model relationship

The shape intentionally follows the existing target `Customer` concepts:

- `businessSlug`;
- `type`;
- `name`;
- `document`;
- `contact.phones`;
- `contact.email`;
- `notes`.

Workflow/transport-only fields such as `ingressRef`, `Idempotency-Key`, `correlationId`, and execution state are **not Customer domain fields** unless explicitly mapped to metadata by Design.

---

## 4. Required fields — mk0 proposal

### Always required

- `businessSlug`.
- `customer.type`.
- `customer.name`.
- `Idempotency-Key` header.

### Contact rule

At least one usable contact locator must be provided:

- one phone, or
- one email.

This avoids forcing phone-only registration into the generic engine while preserving the ability to normalize phones when they exist.

### Optional

- document;
- additional phones;
- email if phone exists;
- notes;
- attachments.

### Not accepted in mk0

- appointment fields;
- time-slot fields;
- `ResourceReservation` data;
- quote/work-order fields;
- AI-generated classification fields.

If a caller needs those later, it must invoke another command/workflow.

---

## 5. Normalization rules

Normalization is deterministic and testable.

### Customer name

- trim leading/trailing whitespace;
- preserve meaningful internal spelling/case for display;
- optionally derive a comparison-normalized value separately rather than mutating display truth.

### Phone

- preserve original components needed for display;
- derive normalized international digits form;
- do not silently invent a country code when context is insufficient.

### Email

- trim whitespace;
- normalize comparison casing where valid;
- preserve original value if later required for display/audit.

### Document

- trim value;
- preserve explicit document type/country;
- validation of authenticity is outside mk0.

### Attachments

- `ingressRef` is opaque;
- caller never supplies final local attachment ID/path;
- final hash must match staged hash when the attachment is committed.

---

## 6. Idempotency contract

Idempotency protects against:

- Postman retry;
- client timeout and retry;
- reverse-proxy retry;
- repeated start calls;
- Temporal Activity retry.

### Identity

Conceptual workflow identity:

```text
register-customer:{businessSlug}:{hash(Idempotency-Key)}
```

The raw idempotency key does not need to be exposed in logs.

### Command fingerprint

A deterministic hash is created from the **normalized material command**.

Material command includes:

- businessSlug;
- normalized customer payload;
- ordered/normalized attachment ingress identities and expected hashes.

It excludes:

- correlation ID;
- request timestamp;
- transport headers unrelated to business intent.

### Same key + same fingerprint

Expected behavior:

- do not create another customer;
- return/query the existing workflow/outcome.

### Same key + different fingerprint

Expected behavior:

`409 IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_COMMAND`

No second workflow/customer is created.

### Natural duplicates

A customer who happens to share phone/email/document data with an existing customer is **not the same problem as idempotent replay**.

Natural-person duplicate detection will be a separate policy. mk0 must not silently merge two customers merely because a field matches.

---

## 7. Start response

Once the Temporal Workflow has been durably accepted:

HTTP status:

`202 Accepted`

Body:

```json
{
  "requestId": "req_01...",
  "correlationId": "corr_01...",
  "workflowId": "register-customer:example-business:...",
  "workflowType": "RegisterNewCustomer",
  "status": "ACCEPTED",
  "statusUrl": "/api/mk0/workflows/register-customer:example-business:..."
}
```

A `202` means:

> the durable process was accepted.

It does **not** mean the customer is already `ACTIVE`.

---

## 8. Workflow status response

Example in progress:

```json
{
  "workflowId": "...",
  "workflowType": "RegisterNewCustomer",
  "status": "RUNNING",
  "phase": "PERSISTING_ATTACHMENTS",
  "correlationId": "corr_01...",
  "customerId": "cus_01...",
  "startedAt": "...",
  "completedAt": null,
  "failure": null
}
```

Example success:

```json
{
  "workflowId": "...",
  "workflowType": "RegisterNewCustomer",
  "status": "COMPLETED",
  "phase": "ACTIVE",
  "correlationId": "corr_01...",
  "customerId": "cus_01...",
  "attachments": [
    {
      "attachmentId": "att_01...",
      "kind": "identity_document",
      "sha256": "..."
    }
  ],
  "failure": null
}
```

---

## 9. Error taxonomy

### HTTP-edge errors — workflow not started

- `INVALID_REQUEST` → 400.
- `MISSING_IDEMPOTENCY_KEY` → 400.
- `INVALID_ATTACHMENT_INGRESS_REF` → 400/422 depending on cause.
- `UNSUPPORTED_MEDIA_TYPE` → 415.
- `PAYLOAD_TOO_LARGE` → 413.
- `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_COMMAND` → 409.
- `ORCHESTRATION_UNAVAILABLE` → 503 when the workflow could not be durably accepted.

### Workflow/business failures — queryable after 202

- `CUSTOMER_PERSISTENCE_FAILED`.
- `ATTACHMENT_PERSISTENCE_FAILED`.
- `ATTACHMENT_INTEGRITY_MISMATCH`.
- `FINALIZATION_FAILED`.
- `REGISTRATION_POLICY_REJECTED`.

Internal stack traces, database paths, credentials, and raw PII are never returned as error details.

---

## 10. Contract success criteria

A conforming implementation must prove:

1. Valid minimal customer can be registered.
2. Valid full customer can be registered.
3. Registration with one/multiple attachments can complete.
4. Same idempotency key + same command does not duplicate.
5. Same idempotency key + different command returns conflict.
6. Bad HTTP/DTO input starts no workflow.
7. Workflow failure remains queryable.
8. Customer read returns the canonical persisted result.
9. No API response exposes a local filesystem/database path.
10. No scheduling record is created by this command.
