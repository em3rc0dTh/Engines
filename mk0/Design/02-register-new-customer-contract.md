# 02 — Register New Customer Contract

## 1. Canonical command

`RegisterNewCustomer`

The command is transport-agnostic. Postman, CLI, a tiny test harness, or a future API adapter must all map into this same command shape.

mk0 does **not** require HTTP, NestJS, REST, gRPC gateway code, or any application framework.

## 2. Command envelope

Conceptual input:

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
  ],
  "request": {
    "idempotencyKey": "caller-generated-opaque-key",
    "correlationId": "optional-caller-correlation"
  }
}
```

A transport adapter may map `idempotencyKey` from a header or CLI flag, but inside the canonical command contract the semantic value is explicit.

## 3. Data-model relationship

The Customer payload follows the approved DataModel v3 / TimeSlots Customer semantics:

- `businessSlug`;
- `type`;
- `name`;
- `document` metadata;
- `contact.phones`;
- `contact.email`;
- optional model-supported WhatsApp/business metadata when explicitly known;
- `notes` when provided.

Workflow/control fields such as idempotency identity, correlation ID, workflow ID, ingress reference and execution phase are not Customer domain fields unless Design explicitly maps them to technical registration metadata.

## 4. Required input — mk0 proposal

Always required:

- `businessSlug`;
- `customer.type`;
- `customer.name`;
- `request.idempotencyKey`.

Contact rule:

- at least one usable phone or email locator.

Optional:

- document;
- additional phones;
- email when phone exists;
- notes;
- attachments.

Forbidden in this command:

- Appointment fields;
- ResourceReservation fields;
- availability/time-slot mutation fields;
- service execution fields;
- quote/work-order fields;
- AI-generated facts presented as Customer truth.

## 5. Pre-start validation

The CTA adapter/harness must reject structurally unusable commands before starting Temporal.

Examples:

```text
INVALID_COMMAND_ENVELOPE
MISSING_BUSINESS_SLUG
MISSING_CUSTOMER_TYPE
MISSING_CUSTOMER_NAME
MISSING_IDEMPOTENCY_KEY
MISSING_CONTACT_LOCATOR
INVALID_ATTACHMENT_REFERENCE_SHAPE
FORBIDDEN_SCHEDULING_FIELD
```

A pre-start rejection produces:

```text
workflowStarted = false
Customer delta = 0
attachment committed delta = 0
```

The exact UI/HTTP/CLI representation of the error is adapter-specific and is not part of the core architecture.

## 6. Normalization

Normalization must be deterministic and testable.

### Name

- trim leading/trailing whitespace;
- preserve meaningful display spelling/case;
- derive comparison-normalized data separately if required.

### Phone

- preserve display components;
- derive normalized international digits only when enough context exists;
- never silently invent missing country context.

### Email

- trim whitespace;
- normalize comparison casing where valid.

### Document

- trim value;
- preserve explicit type/country;
- authenticity verification is outside mk0.

### Attachments

- `ingressRef` is opaque;
- caller never supplies a final storage path;
- integrity metadata is server/system computed or independently verified before commitment.

## 7. Idempotency contract

Conceptual Workflow ID:

```text
register-customer:{businessSlug}:{hash(idempotencyKey)}
```

A deterministic command fingerprint is generated from the normalized material command.

Material input includes:

- businessSlug;
- normalized Customer payload;
- normalized attachment ingress identities/expected integrity metadata.

It excludes:

- correlation ID;
- request timestamp;
- adapter-specific transport metadata.

### Same idempotency key + same fingerprint

Return/observe the existing logical registration outcome. Do not create another Customer.

### Same idempotency key + different fingerprint

Reject as:

`IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_COMMAND`

No second logical workflow/customer may be created for the changed command.

Natural duplicate-person policy is separate from idempotent replay and is not invented by mk0.

## 8. Temporal start contract

Successful CTA submission means only:

> Temporal durably accepted the `RegisterNewCustomer` workflow identity.

Conceptual acceptance projection:

```json
{
  "workflowId": "register-customer:example-business:...",
  "workflowType": "RegisterNewCustomer",
  "correlationId": "corr_01...",
  "status": "ACCEPTED"
}
```

The CTA may receive this through CLI output, Postman/gRPC response, a minimal adapter, or another test surface. `202 Accepted` is only an HTTP mapping if HTTP is later used; it is **not** a core requirement.

## 9. Workflow query/result contract

In-progress projection:

```json
{
  "workflowId": "...",
  "status": "RUNNING",
  "phase": "PERSISTING_CUSTOMER_BASE",
  "correlationId": "...",
  "customerId": null,
  "failure": null
}
```

Successful projection:

```json
{
  "workflowId": "...",
  "status": "COMPLETED",
  "phase": "COMPLETED",
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

Failed projection includes a typed failure classification, not raw stack traces, credentials, database internals or unrestricted PII.

## 10. Persistence output contract

A successful workflow must prove:

### PostgreSQL

- exactly one canonical Customer registration;
- exactly one logical registration/idempotency receipt;
- normalized approved Customer data;
- attachment references when applicable;
- final successful registration state only after mandatory effects complete.

### MongoDB

- required execution/audit milestones;
- workflow/application context required by Design;
- no unrestricted duplicate Customer shadow document.

### AttachmentStore

When attachments exist:

- stable committed attachment identity;
- integrity metadata;
- retrievable content/object;
- no duplicate logical attachment on Activity retry.

## 11. Contract success criteria

A conforming mk0 implementation proves:

1. minimal valid Customer can be registered;
2. full valid Customer can be registered;
3. optional attachments can be persisted/referenced;
4. same key + same command is idempotent;
5. same key + different command conflicts;
6. invalid structural input starts no workflow;
7. CTA disconnect/reconnect does not lose accepted workflow progress;
8. workflow failure remains queryable;
9. PostgreSQL result follows approved TimeSlots Customer semantics;
10. required MongoDB audit/context exists;
11. no persistence internals leak into the caller contract;
12. zero scheduling side effects occur.
