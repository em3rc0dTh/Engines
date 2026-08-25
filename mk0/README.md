# mk0 — First Engines Laboratory Proof

## Current state

mk0 is the first executable proof of `Engines`, not the final scope of the orchestration platform.

`RegisterNewCustomer` is the first specimen used to prove the reusable architecture spine.

Current runtime status:

```text
B0–B6                              ✅ CERTIFIED
attachment-free integrated Golden ✅ 14 / 14 PASS
B7 AttachmentStore                🔒 GATED
attachment cases                  ⏳ GD-003/004/009/010
full mk0                           ⏳ NOT YET COMPLETE
```

Integrated receipt:

```text
Source SHA:      f0896c58d918e8f3971c78867870243e16a8b604
GitHub run ID:   32873848134
Artifact:        mk0-core-golden-release-32873848134
Artifact digest: sha256:25fea20c892ea7cd758788ac63a53ba9048b8809599f2b972c5ef77942c2b4e8
Verdict:         ATTACHMENT_FREE_CORE_GOLDEN_PASS
```

Detailed evidence:

```text
Build/evidence/mk0-core-golden-release-certification-2026-08-25.md
```

## Target Engines shape

```text
INPUT CHANNELS
CLI / Postman now
Form / WhatsApp / Telegram / Web / Mobile / API / Webhook / future adapters
                         ↓
                 CHANNEL / CTA ADAPTER
                         ↓
                 canonical operation
                         ↓
┌──────────────────────────────────────────────────────┐
│ ORCHESTRATION ENGINE — TEMPORAL                     │
│                                                      │
│ Workflow Library                                     │
│ durable Workflow Execution                           │
│ Task Queues / Workers / Activities                   │
│ Queries / Updates / Signals                          │
│ retries / timeouts / recovery / replay               │
│ visibility / durable Event History                   │
└───────────────────────┬──────────────────────────────┘
                        ↓
               ACTIVITIES / PORTS
       ┌────────────────┼──────────────────┐
       ↓                ↓                  ↓
   PostgreSQL        MongoDB         AttachmentStore
   business truth    audit/context   binary/documents
       │                │                  │
       └────────────────┼──────────────────┘
                        ↓
              OUTBOUND / NOTIFICATION PORTS
```

The channel is replaceable. The Workflow is reusable. Temporal remains the durable orchestration authority.

## Certified mk0 slice today

```text
CLI CTA ───────────────┐
                       │
Postman HTTP CTA ──────┼→ CTA Adapter
                       │       ↓
                       └→ canonical RegisterNewCustomer start
                               ↓
                           Temporal
                               ↓
                    RegisterNewCustomer Workflow
                               ↓
                    PostgreSQL + MongoDB
                               ↓
                       canonical result
```

Attachment-bearing execution remains outside the certified slice until B7.

## What the first experiment has taught us

The attachment-free runtime has physically proved that the same orchestration model can:

1. receive the same operation from replaceable transport adapters;
2. reject structurally invalid session input before business execution;
3. accept incomplete-but-legal registration intent;
4. wait durably for policy-required data;
5. receive multiple Updates without opening a new Workflow;
6. preserve business-scoped idempotency across completed-session replay;
7. distinguish exact replay from a materially conflicting start;
8. execute PostgreSQL side effects through retry-safe Activities;
9. distinguish new, hard-duplicate and soft-duplicate Customer states;
10. require MongoDB audit evidence before reporting terminal success;
11. survive CTA process death;
12. survive Worker process death after a Customer has already been persisted;
13. recover the same Workflow/Run without duplicate Customer effect;
14. keep scheduling side effects completely outside `RegisterNewCustomer`.

That is the reusable pattern Engines is intended to extend to later Workflows such as:

```text
CreateAppointment
RescheduleAppointment
CancelAppointment
OpenCase
RegisterManagedEntity
CreateAssessment
CreateQuote
ApproveQuote
CreateWorkOrder
NotifyCustomer
...
```

Those future Workflows are not implemented by mk0 merely because the pattern is now proven.

## CTA / Channel Adapter

The adapter is the stable boundary around external channels.

### Inbound responsibility

- receive source-specific input;
- identify source/channel and correlation context;
- validate transport/session structure;
- normalize into the canonical operation contract;
- start, query or update the appropriate Temporal Workflow;
- eventually stage/reference attachments when B7 is available.

The CTA is **not** Customer-completeness authority.

A legal partial/intent-only start enters Temporal. The versioned `RegistrationPolicy` determines missing fields and may place the Workflow in:

```text
WAITING_FOR_REQUIRED_DATA
```

### Current proof adapters

```text
CLI
Postman-compatible HTTP via node:http
```

The HTTP adapter is deliberately framework-free. It demonstrates that an application framework is not required to own the orchestration boundary.

The integrated Golden gate proved that this HTTP CTA can be killed after Workflow acceptance and the same Workflow/Run remains queryable/updatable from a fresh client.

### Outbound responsibility

A channel adapter may render canonical Workflow state/result, but it does not invent business truth or durable Workflow state.

## Temporal authority

`Temporal` means the real Temporal platform, not a custom state-machine imitation.

The certified core uses:

- Temporal Service;
- Task Queue `engines-mk0-registration`;
- Workers;
- Workflow Execution;
- Activities;
- Event History;
- Query `GetRegistrationState`;
- Update `ProvideCustomerData`;
- retry/recovery semantics;
- Workflow replay/determinism.

Workflow code performs no direct PostgreSQL/MongoDB/file/network side effects. Those effects belong in Activities and explicit ports.

## RegisterNewCustomer pattern

```text
RECEIVE REGISTRATION SESSION
      ↓
RESERVE BUSINESS-SCOPED SESSION
      ↓
LOAD VERSIONED REGISTRATION POLICY
      ↓
DO WE HAVE REQUIRED INPUT?
  ├── no → WAITING_FOR_REQUIRED_DATA
  │          ↑
  │          └── ProvideCustomerData Update(s)
  └── yes
      ↓
CHECK EXISTING CUSTOMER
      ↓
 ┌────────────┼──────────────┐
 ↓            ↓              ↓
NONE       HARD_UNIQUE    SOFT_MATCH
 ↓            ↓              ↓
CREATE      RESOLVE       WAIT FOR
CUSTOMER    EXISTING      DECISION
 └────────────┬──────────────┘
              ↓
     PERSIST REQUIRED AUDIT
              ↓
      VERIFY AUDIT COMPLETE
              ↓
     POSTGRESQL FINALIZATION
              ↓
     CREATED | ALREADY_EXISTS
```

Soft duplicate is not silently transformed into a hard duplicate or automatic merge.

## Registration session identity

The frozen session scope is:

```text
(operation, businessSlug, idempotencyKeyHash)
```

The normalized material initial start is fingerprinted.

The integrated gate proved completed-session behavior:

```text
same session identity + same fingerprint
→ same Workflow ID
→ same Run ID
→ no second business effect

same session identity + different fingerprint
→ SESSION_IDEMPOTENCY_CONFLICT
→ original execution remains authoritative
```

`correlationId` and presentation/channel metadata do not redefine material start identity.

Later `ProvideCustomerData` Updates evolve durable Workflow state without rewriting the frozen initial fingerprint.

## Persistence authority

### PostgreSQL

Canonical transactional/business truth for:

- Customer;
- Customer contact/document projections;
- business-scoped registration/session identity;
- initial-start fingerprint;
- duplicate/creation outcome;
- audited terminal registration state;
- future attachment references after B7.

The integrated gate also proved a transient `createCustomer` Activity failure retries to exactly one Customer.

### MongoDB

Application interaction/audit/context evidence.

Mandatory success-gating events include the applicable subset of:

```text
REGISTRATION_SESSION_STARTED
REGISTRATION_POLICY_LOADED
REQUIRED_DATA_REQUESTED
CUSTOMER_DATA_ACCEPTED
DUPLICATE_CHECK_COMPLETED
CUSTOMER_CREATED | EXISTING_CUSTOMER_RESOLVED
ATTACHMENT_COMMITTED        when B7 applies
REGISTRATION_COMPLETED
```

MongoDB is not canonical Customer truth and is not a substitute for Temporal Event History.

Successful `CREATED` / `ALREADY_EXISTS` is forbidden while required audit evidence is missing.

B6 separately proved exhausted mandatory-audit failure yields:

```text
MONGO_AUDIT_STORE_UNAVAILABLE
```

rather than false success.

### AttachmentStore

Future binary/document truth authority.

It is **not yet implemented/certified** in mk0.

B7 entry requires an explicit project-authority decision after physical technology and fixture closure.

## Strong durability proof

GD-011 proves more than “restart the Worker while waiting.”

Certification allowed PostgreSQL Customer creation to complete, delayed the mandatory `CUSTOMER_CREATED` audit Activity, observed:

```text
CUSTOMER_CREATED_PENDING_AUDIT
```

and then killed that Worker.

A new Worker resumed the same Workflow/Run and completed with the same Customer ID and one Customer row.

```text
Delayed Worker PID:  5689
Recovery Worker PID: 6120
Customer duplicates: 0
```

This is the core evidence that durable orchestration authority does not live in a specific Worker process.

## Golden Dataset status

```text
GD-001 PASS
GD-002 PASS
GD-003 DEFERRED_B7
GD-004 DEFERRED_B7
GD-005 PASS
GD-006 PASS
GD-007 PASS
GD-008 PASS
GD-009 DEFERRED_B7
GD-010 DEFERRED_B7
GD-011 PASS
GD-012 PASS
GD-013 PASS
GD-014 PASS
GD-015 PASS
GD-016 PASS
GD-017 PASS
GD-018 PASS
```

No case is unaccounted for.

## Observability laboratory

The core can now be inspected from multiple independent planes:

```text
CLI / Postman
→ submitted operation and returned state/result

Temporal CLI / Web UI
→ Workflow / Run / Task Queue / Activities / Updates / Event History

PostgreSQL
→ canonical registration and Customer truth

MongoDB
→ mandatory application audit/context evidence
```

AttachmentStore evidence is added only after B7.

## Core invariants

1. External channels are replaceable adapters.
2. All durable business orchestration belongs to Temporal.
3. Workflow definitions are channel-independent.
4. Workflow code performs no direct external side effects.
5. Side effects happen through retry-safe Activities and ports.
6. PostgreSQL/MongoDB/AttachmentStore have explicit authority boundaries.
7. Workflow state is observable independently from the originating channel.
8. CTA process loss does not destroy an accepted Workflow.
9. Worker process loss does not redefine durable Workflow identity.
10. `RegisterNewCustomer` is the first proof Workflow, not the final Workflow catalog.
11. Registration identity is business-scoped and deterministic.
12. Exact completed-session replay returns the existing logical execution.
13. Conflicting replay creates no second business effect.
14. Later Workflow Updates do not mutate the immutable initial-start fingerprint.
15. Mandatory audit evidence is required before successful registration.
16. PostgreSQL retry/recovery must not duplicate Customer effects.
17. Hard and soft duplicate semantics remain policy-defined and distinguishable.
18. `RegisterNewCustomer` produces zero scheduling effects.
19. Attachment-bearing success is forbidden while B7 is closed.
20. Workflow changes must preserve Temporal replay/version compatibility.

## Non-goals for mk0

- completing the entire Engines Workflow Library;
- implementing every possible CTA channel;
- implementing Agent/Hermes;
- building every business engine;
- selecting a permanent application/web framework;
- building the final Engines control-room UI;
- claiming production deployment certification from laboratory runtime evidence.

## Current gate order

The original Design → Plan → Test → Golden → Build authorization gates have already been crossed for B0–B6.

The current transition is:

```text
B0–B6
  ↓
stage certifications
  ↓
attachment-free integrated Golden
  ↓
✅ SYSTEM CERTIFIED
  ↓
PROJECT AUTHORITY B7 DECISION
  ↓
AttachmentStore technology / fixtures / hashes
  ↓
B7
  ↓
GD-003 / GD-004 / GD-009 / GD-010
  ↓
FULL MK0 GOLDEN CERTIFICATION
```

Current gate status is tracked in [`Plan/mk0-gate-status.md`](Plan/mk0-gate-status.md).

> **mk0 attachment-free core = system-certified. B7 = gated. Full mk0 = not yet complete.**
