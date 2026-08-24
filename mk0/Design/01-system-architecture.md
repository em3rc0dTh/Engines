# 01 — System Architecture

## 1. Architectural objective

mk0 proves one framework-agnostic vertical:

```text
┌────────────────────────────────────────────┐
│ 1. CTA / CONTROLLED ENTRY                  │
│ Postman | CLI | minimal test harness       │
└───────────────────┬────────────────────────┘
                    │ validated command
                    ▼
┌────────────────────────────────────────────┐
│ 2. ORCHESTRATION ENGINE                    │
│ Temporal                                   │
│ RegisterNewCustomer Workflow + Activities  │
└───────────────────┬────────────────────────┘
                    │ persistence ports
                    ▼
┌────────────────────────────────────────────┐
│ 3. PERSISTENCE                             │
│ PostgreSQL → Customer/registration truth   │
│ MongoDB    → audit/workflow context        │
│ AttachmentStore → binary/documents if any  │
└────────────────────────────────────────────┘
```

No NestJS, Express, Fastify or other application framework is architectural authority in mk0.

## 2. CTA / controlled entry

The first CTA is a test caller, not business logic.

Allowed initial forms:

- Postman, including gRPC/HTTP only if a minimal compatible adapter is later required;
- CLI using a Temporal client;
- tiny executable test harness using a Temporal SDK/client.

The architectural requirement is the command contract, not the transport technology.

CTA responsibilities:

- construct `RegisterNewCustomer` input;
- validate structural/transport-safe input before submission;
- provide `Idempotency-Key` or equivalent explicit idempotency identity;
- provide correlation metadata when useful;
- stage or reference optional attachment ingress without pushing large binaries into Workflow history;
- start the Temporal workflow;
- query/observe the workflow outcome.

CTA must not:

- write PostgreSQL directly;
- write MongoDB directly;
- persist attachments as final business objects directly;
- execute the registration state machine;
- retry database side effects;
- infer scheduling or services.

## 3. Input safety boundary

The entry contract has two validation layers.

### Pre-start structural validation

Reject before Workflow start when input is unusable as a command, for example:

- missing required command identity;
- malformed envelope;
- missing `businessSlug`;
- missing Customer type/name;
- no usable contact locator when the contract requires one;
- malformed attachment reference metadata;
- forbidden scheduling/service fields in this command.

### Durable workflow/business validation

Validation that depends on persisted state or workflow policy belongs in Temporal Activities/workflow orchestration.

A rejected structural command produces **zero business side effects**.

## 4. Orchestration Engine — Temporal

Workflow type:

`RegisterNewCustomer`

Temporal owns:

- durable command acceptance;
- workflow identity;
- ordered phases;
- transient retry behavior;
- restart/crash recovery;
- coordination of PostgreSQL, MongoDB and attachment effects;
- queryable execution status;
- terminal success/failure.

Temporal Workflow code coordinates only. Side effects are performed by Activities/adapters.

Conceptual state machine:

```text
ACCEPTED
→ VALIDATING_COMMAND
→ RESERVING_IDEMPOTENCY
→ PERSISTING_CUSTOMER_BASE
→ PERSISTING_ATTACHMENTS      optional
→ LINKING_ATTACHMENTS         optional
→ PERSISTING_AUDIT_CONTEXT
→ FINALIZING_CUSTOMER
→ COMPLETED
```

Any permanent failure produces a typed terminal outcome while preserving enough durable identity for diagnosis and safe replay/recovery.

## 5. Data-model contract — TimeSlots Customer

The canonical semantic source is `DATA_MODEL_VTKALL_DataModel-0_v3_timeslots.md`.

The first workflow projects only the Customer concern. Conceptually:

```text
Customer
├── businessSlug
├── type
├── name
├── document
├── contact
│   ├── phones[]
│   └── email
├── whatsapp
├── metrics
├── notes
├── status
├── createdAt
└── updatedAt
```

Rules:

- persist only known/approved values;
- do not invent business facts to fill optional fields;
- transport/workflow metadata is not automatically Customer domain data;
- `ManagedEntity` and scheduling entities remain outside this workflow.

## 6. Persistence authorities

### PostgreSQL — canonical business authority

Owns:

- Customer identity and approved relational projection;
- normalized Customer/contact/document fields;
- registration state/version;
- idempotency/command receipt;
- final opaque attachment references required by the Customer registration.

### MongoDB — execution/audit/context authority

Owns:

- `execution_audit` milestones;
- workflow/application context documents;
- safe execution metadata and failure classifications.

MongoDB does not become a second canonical Customer store.

### AttachmentStore — optional binary/document authority

Owns when attachments exist:

- staged/committed binary or document object;
- opaque object identity;
- SHA-256/integrity metadata;
- media type/length;
- lifecycle/TTL/reconciliation state.

The exact physical technology is deferred to Build. It may use MongoDB/GridFS or another persistence technology, but the contract must remain separate from Customer truth.

## 7. Primary control flow

### No attachments

```text
CTA
  ↓ RegisterNewCustomer
Temporal
  ├→ Activity: reserve command/idempotency        → PostgreSQL
  ├→ Activity: persist Customer                   → PostgreSQL
  ├→ Activity: append required audit/context      → MongoDB
  └→ Activity: finalize Customer                  → PostgreSQL
  ↓
COMPLETED
```

### With attachments

```text
CTA
  ↓ stage/reference attachment ingress
AttachmentStore STAGED
  ↓ ingressRef
CTA
  ↓ RegisterNewCustomer + ingressRef
Temporal
  ├→ PostgreSQL: reserve command + Customer base
  ├→ AttachmentStore: commit/verify attachment(s)
  ├→ PostgreSQL: link opaque attachment reference(s)
  ├→ MongoDB: audit/context
  └→ PostgreSQL: finalization
```

Large binary content does not travel as ordinary Workflow history payload.

## 8. Continuity requirement

The system must remain correct even when the CTA disconnects after start.

```text
CTA start
→ Temporal durable acceptance
→ CTA disappears/reconnects
→ Workflow continues
→ CTA later queries same workflow/outcome
```

Therefore continuity is provided by durable workflow identity and persistence, not by keeping a network socket permanently open.

## 9. Authority matrix

| Concern | Authority | Not authority |
|---|---|---|
| Command input shape | mk0 command contract | Framework |
| Structural pre-start validation | CTA adapter/harness contract | Database |
| Durable workflow order | Temporal | CTA |
| Customer business truth | PostgreSQL | MongoDB audit |
| Registration/idempotency truth | PostgreSQL | CTA memory |
| Temporal Event History | Temporal | MongoDB audit |
| Application execution audit/context | MongoDB | Customer tables |
| Attachment bytes/documents | AttachmentStore | Customer relational columns |
| Attachment business reference | PostgreSQL | CTA-local path |
| Scheduling capacity | Future Scheduler/ResourceReservation | RegisterNewCustomer |

## 10. Forbidden couplings

```text
CTA → PostgreSQL/MongoDB direct writes          FORBIDDEN
CTA → final attachment commit bypassing workflow FORBIDDEN
Temporal Workflow → DB/file/network driver       FORBIDDEN
MongoDB audit → canonical Customer truth          FORBIDDEN
RegisterNewCustomer → Appointment                 FORBIDDEN
RegisterNewCustomer → ResourceReservation         FORBIDDEN
Framework choice → architecture dependency        FORBIDDEN in mk0
```

## 11. Cross-store consistency

PostgreSQL, MongoDB and AttachmentStore do not share one atomic transaction.

Temporal mediates consistency:

- Customer finalization only after all mandatory effects succeed;
- retry after PostgreSQL side effect reuses the same registration identity;
- retry after attachment commit reuses the same logical attachment;
- retryable audit milestones use stable event identity;
- permanent attachment failure cannot become false success;
- partial/orphan attachment state remains discoverable for reconciliation.

## 12. mk0 success condition

```text
controlled CTA command
→ Temporal durable start
→ TimeSlots-aligned Customer input projection
→ exactly one PostgreSQL Customer registration
→ MongoDB audit/context evidence
→ optional attachment persisted + referenced
→ CTA can query final outcome after reconnect
→ retries/restarts create no duplicate logical effects
→ zero scheduling side effects
```
