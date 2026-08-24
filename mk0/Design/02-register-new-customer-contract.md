# 02 — Register New Customer Contract

## 1. Canonical intent

`RegisterNewCustomer`

The CTA is replaceable. Postman and CLI are the mk0 laboratory callers; forms, MCP, WhatsApp, Telegram, web/mobile clients and other channels may later map into the same interaction contract.

The important boundary is not HTTP. It is:

```text
channel input
→ CTA Adapter
→ Temporal-managed RegisterNewCustomer
→ persistence Activities
```

No application framework is required by this contract.

## 2. Interactive workflow decision

`RegisterNewCustomer` is a **durable interactive workflow**, not only a one-shot command.

It may start with only enough information to identify the requested operation and business context. Missing Customer data is then collected while the Temporal Workflow remains alive.

Example:

```text
CTA: I want to register a customer
Temporal state: WAITING_FOR_REQUIRED_DATA
Temporal projection: missing = [customer.name, customer.contact]

CTA: provides name + phone
Temporal: validates/merges data
Temporal: required data complete
Temporal: checks existing-customer policy
Temporal: persists or returns existing-customer outcome
```

This behavior is intentionally compatible with future conversational CTAs without requiring an Agent.

## 3. Start envelope

The Workflow start payload is a **registration session/intent envelope**, not necessarily a complete Customer.

Conceptual input:

```json
{
  "operation": "RegisterNewCustomer",
  "businessSlug": "example-business",
  "draft": {
    "customer": {}
  },
  "request": {
    "idempotencyKey": "caller-generated-opaque-key",
    "correlationId": "optional-caller-correlation",
    "channel": "postman"
  },
  "schemaVersion": "mk0.register-customer.v0"
}
```

Minimum **start** requirements:

- operation is recognizable;
- `businessSlug` exists;
- session/request idempotency identity exists;
- envelope is structurally valid.

Missing Customer business fields do **not** automatically prevent Workflow start. They cause a durable waiting state.

## 4. Registration policy

The Workflow must not invent its own universal list of required fields.

The approved DataModel v3 / TimeSlots source defines the Customer shape and describes `BusinessProfile` as the place that answers what fields a business asks for. mk0 therefore introduces a versioned **RegistrationPolicy** concept, logically derived from the active BusinessProfile/WorkflowProfile or an equivalent approved configuration.

A resolved policy contains conceptually:

```text
policyId
policyVersion
businessSlug
requiredCustomerFields
normalizationRules
duplicatePolicy
attachmentPolicy
completionRules
```

Example mk0 policy may require:

```text
customer.name
AND at least one of:
  customer.contact.phones[]
  customer.contact.email
```

Document may be optional in one business and required in another. `lastName` and `address` are not invented as mandatory canonical fields unless the data model/profile is explicitly extended to include them.

The Workflow uses one resolved/versioned policy for the execution so a configuration change cannot silently redefine an already-running registration.

## 5. Customer data relationship

The draft/final Customer follows the approved TimeSlots Customer semantics:

```text
Customer
├── businessSlug
├── type
├── name
├── document?   { type, value, country }
├── contact
│   ├── phones[]
│   └── email?
├── whatsapp?   model-supported when known
├── metrics?    business-derived only
├── notes?
├── status
├── createdAt
└── updatedAt
```

Workflow/session metadata is not Customer domain data.

`RegisterNewCustomer` cannot implicitly create `Appointment`, `ResourceReservation`, availability mutations, quotes, work orders or service execution.

## 6. Interaction contract

### 6.1 Query — `GetRegistrationState`

Read-only projection from the running Workflow.

Example waiting state:

```json
{
  "workflowId": "register-customer:example-business:...",
  "status": "RUNNING",
  "phase": "WAITING_FOR_REQUIRED_DATA",
  "policyVersion": "customer-registration-v1",
  "knownFields": ["customer.name"],
  "missingFields": ["customer.contact.phoneOrEmail"],
  "nextAction": "PROVIDE_CUSTOMER_DATA",
  "customerId": null,
  "result": null
}
```

### 6.2 Update — `ProvideCustomerData`

A tracked mutation sent to the same Workflow identity.

Conceptual payload:

```json
{
  "inputId": "input_002",
  "customerPatch": {
    "name": "Ana Torres",
    "contact": {
      "phones": [
        {
          "countryCode": "+51",
          "number": "955000111"
        }
      ]
    }
  }
}
```

The update:

- validates the patch shape;
- normalizes allowed fields;
- merges it into the durable registration draft;
- records the accepted interaction through the audit Activity policy;
- returns the new safe state projection.

Each accepted external input has a stable `inputId`/Update identity so channel retries do not create duplicate logical interactions.

### 6.3 Future interaction messages

The same pattern can later support:

- correction of a field;
- duplicate-resolution decision;
- attachment provision;
- approval;
- cancellation when explicitly designed.

Postman/CLI do not own these business states; they only send/query Temporal messages.

## 7. Workflow progression

```text
STARTED
  ↓
LOADING_REGISTRATION_POLICY
  ↓
COLLECTING_DATA
  ├── missing → WAITING_FOR_REQUIRED_DATA
  │               ↑              │
  │               └─ ProvideCustomerData Update
  │                              ↓
  └────────────────────── REVALIDATE_DRAFT
                                 ↓
                      REQUIRED_DATA_COMPLETE
                                 ↓
                       CHECKING_EXISTING_CUSTOMER
                          ┌──────┴───────┐
                          │              │
                    existing         new
                          │              │
                          ▼              ▼
                 ALREADY_EXISTS     PERSISTING_CUSTOMER
                                         ↓
                                 PERSISTING_ATTACHMENTS?
                                         ↓
                                 PERSISTING_AUDIT_CONTEXT
                                         ↓
                                     COMPLETED
```

## 8. Existing-customer / duplicate policy

Idempotent replay and natural duplicate detection are different concerns.

### Session idempotency

The start `idempotencyKey` identifies the registration attempt/session. Repeating the same start must resolve the same logical Workflow rather than create another registration session.

### Natural duplicate detection

The RegistrationPolicy defines which identifiers are:

- `HARD_UNIQUE` — blocks creation and resolves to an existing-customer outcome;
- `SOFT_MATCH` — creates a possible-duplicate state/warning and may require an explicit decision;
- `NON_UNIQUE` — never used alone to reject creation.

Generic mk0 guidance:

- an explicitly unique document identifier may be `HARD_UNIQUE` within a business when policy says so;
- phone/email should not be universally assumed hard-unique because real businesses may legitimately share them;
- name matching is never sufficient by itself for hard duplicate rejection.

The exact duplicate rule is frozen per RegistrationPolicy, not guessed by the Workflow.

## 9. Existing-customer outcomes

Hard duplicate example:

```json
{
  "status": "COMPLETED",
  "phase": "ALREADY_EXISTS",
  "created": false,
  "customerId": "cus_existing_001",
  "reason": "HARD_UNIQUE_IDENTIFIER_MATCH"
}
```

No second Customer is created.

New-customer example:

```json
{
  "status": "COMPLETED",
  "phase": "CREATED",
  "created": true,
  "customerId": "cus_002"
}
```

## 10. Persistence outputs

### PostgreSQL

Canonical business authority:

- Customer;
- contacts/documents according to approved projection;
- registration/session identity;
- final registration result;
- attachment references where applicable.

### MongoDB

Application interaction/audit authority:

- workflow accepted;
- policy loaded/version;
- required-data request(s);
- accepted input interaction(s);
- duplicate-check outcome classification;
- persistence milestones;
- final outcome/failure classification.

Do not copy unrestricted secrets or raw binary payloads. Customer PII retention in interaction records must follow an explicit policy; tests use synthetic data.

### AttachmentStore

Optional actual binary/document content with stable opaque IDs and integrity metadata.

## 11. CTA rendering rule

Temporal does not need to know whether the caller is Postman, CLI, WhatsApp or Telegram.

It exposes canonical state such as:

```text
missingFields
nextAction
validationErrors
possibleDuplicate
result
```

The CTA Adapter renders that state for its channel:

```text
Temporal: missingFields = [customer.name, customer.contact.phoneOrEmail]

Postman → JSON
CLI     → terminal text
WhatsApp→ human-readable message
Form    → highlighted required fields
MCP     → structured tool result
```

This is how Temporal can effectively "ask for missing information" without coupling Workflow logic to a user interface.

## 12. Contract success criteria

A conforming mk0 implementation proves:

1. intent-only/partial registration can durably start;
2. Workflow exposes exactly which policy-required data is missing;
3. CTA can submit additional data to the same Workflow;
4. accepted inputs survive CTA disconnect/reconnect;
5. full valid draft advances automatically;
6. duplicate lookup occurs through an Activity, not direct Workflow database access;
7. hard duplicate creates no second Customer;
8. new Customer creates exactly one canonical PostgreSQL record;
9. MongoDB contains the required interaction/audit trail;
10. optional attachments persist through AttachmentStore and are referenced safely;
11. Worker restart/retry does not duplicate the logical registration;
12. zero scheduling side effects occur.
