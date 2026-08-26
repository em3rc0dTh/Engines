# mk0 — First Engines Laboratory Proof

## Current state

mk0 is the first executable proof of **Engines**, not the final scope of the orchestration platform.

`RegisterNewCustomer` is the first specimen used to prove the reusable architecture spine.

Current status:

```text
B0–B7                              ✅ CERTIFIED
Golden Dataset                    ✅ 18 / 18 PASS
WSL2 + Docker Compose laboratory  ✅ PHYSICALLY PROVEN
Postman manual collection         ✅ 37 / 37 PASS
Full mk0 laboratory               ✅ SYSTEM_CERTIFIED
Production deployment             ❌ NOT CERTIFIED
Broader Engines workflow library  ⏳ NOT IMPLEMENTED BY MK0
```

Primary current receipt:

```text
Build/evidence/mk0-full-local-laboratory-certification-2026-08-26.md
```

## Proven Engines shape

```text
INPUT CHANNELS
CLI / Postman today
future form / WhatsApp / Telegram / Web / Mobile / API / Webhook adapters
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
              canonical result / outbound adapter
```

The channel is replaceable. The Workflow is reusable. Temporal remains the durable orchestration authority.

## Certified mk0 local laboratory

```text
Windows / Postman
      ↓ localhost:8787
HTTP CTA
      ↓
Temporal
      ↓
RegisterNewCustomer Workflow
      ↓
Worker / Activities
      ↓
PostgreSQL + MongoDB + AttachmentStore
```

The laboratory is launched with Docker Compose inside WSL2. Public tunnels, cloud deployment and internet exposure are explicitly outside this certification.

## What mk0 proved

The complete first specimen physically demonstrates that the same orchestration model can:

1. receive one canonical operation from replaceable CTA surfaces;
2. reject structurally invalid session input before business execution;
3. accept incomplete-but-legal registration intent;
4. wait durably for versioned policy-required data;
5. receive multiple `ProvideCustomerData` Updates in the same Workflow;
6. preserve business-scoped idempotency after completion;
7. distinguish exact replay from materially conflicting replay;
8. perform retry-safe PostgreSQL Customer effects;
9. distinguish new, hard-duplicate and soft-duplicate states;
10. require MongoDB audit evidence before terminal success;
11. survive CTA process death;
12. survive Worker death after a Customer has already been persisted;
13. recover the same Workflow/Run without duplicating the Customer;
14. stage, resolve and commit binary attachments outside Workflow history;
15. verify attachment integrity with SHA-256;
16. keep logical attachment identity retry-safe while binary blobs are content-addressed;
17. require PostgreSQL attachment linkage + `ATTACHMENT_COMMITTED` audit before attachment-bearing success;
18. reject post-stage binary corruption without false success;
19. enforce staged-ingress TTL and laboratory limits;
20. keep scheduling effects completely outside `RegisterNewCustomer`.

## Golden Dataset

```text
GD-001 PASS
GD-002 PASS
GD-003 PASS
GD-004 PASS
GD-005 PASS
GD-006 PASS
GD-007 PASS
GD-008 PASS
GD-009 PASS
GD-010 PASS
GD-011 PASS
GD-012 PASS
GD-013 PASS
GD-014 PASS
GD-015 PASS
GD-016 PASS
GD-017 PASS
GD-018 PASS

18 / 18 PASS
```

Core 14 cases were re-exercised on B7-capable code. The old core workflow's only failing step was its deliberately obsolete pre-B7 assertion that attachments must remain gated.

The B7 Compose runtime independently certified the four attachment cases in successful GitHub Actions run:

```text
32896780937
```

against source:

```text
80a95d0b9715f91879a9e0cbd7230828098ba997
```

## Physical manual proof

On 2026-08-26 the complete Postman manual-certification collection was executed against the local WSL2/Docker Compose laboratory.

```text
Tests               37
Errors              0
Failed assertions   0
Verdict             37 / 37 PASS
```

The manual run covered health, interactive waiting/Updates, terminal creation, exact replay, typed session conflict, AttachmentStore stage/resolve, attachment-bearing registration, CTA 400 rejection and typed absent-ingress 404 behavior.

## CTA / Channel Adapter

The CTA is the stable boundary around external channels.

Inbound responsibilities:

- receive source-specific input;
- identify channel/correlation context;
- validate transport/session structure;
- normalize into a canonical operation;
- start/query/update the appropriate Temporal Workflow;
- stage binary ingress outside Temporal and pass only metadata/reference identity into orchestration.

The CTA is not Customer-completeness authority and never directly owns canonical persistence.

Current proof adapters:

```text
CLI
Postman-compatible HTTP via node:http
```

## Temporal authority

`Temporal` means the real Temporal platform, not an in-process imitation.

The certified mk0 uses:

- Temporal Service;
- Task Queue `engines-mk0-registration`;
- Worker processes;
- Workflow Execution;
- Activities;
- Event History;
- Query `GetRegistrationState`;
- Update `ProvideCustomerData`;
- Activity retries;
- process-loss recovery;
- deterministic Workflow replay semantics.

Workflow code performs no direct PostgreSQL, MongoDB, filesystem or network side effects.

## Registration session identity

The frozen business session scope is:

```text
(operation, businessSlug, idempotencyKeyHash)
```

The material initial start is normalized and fingerprinted.

Certified behavior:

```text
same session identity + same fingerprint
→ same Workflow ID
→ same Run ID
→ no second business effect

same session identity + different fingerprint
→ SESSION_IDEMPOTENCY_CONFLICT
→ original execution remains authoritative
```

Later Workflow Updates evolve durable state without rewriting the immutable initial fingerprint.

## Persistence authority

### PostgreSQL

Canonical transactional/business truth for:

- Customer;
- registration/session identity;
- duplicate/creation outcome;
- initial fingerprint;
- terminal registration state;
- immutable Customer attachment references.

### MongoDB

Mandatory application execution/audit/context evidence.

MongoDB is not canonical Customer truth and is not Temporal Event History.

Applicable success-gating events include:

```text
REGISTRATION_SESSION_STARTED
REGISTRATION_POLICY_LOADED
REQUIRED_DATA_REQUESTED
CUSTOMER_DATA_ACCEPTED
DUPLICATE_CHECK_COMPLETED
CUSTOMER_CREATED | EXISTING_CUSTOMER_RESOLVED
ATTACHMENT_COMMITTED
REGISTRATION_COMPLETED
```

### AttachmentStore

Binary/document truth authority for mk0.

Physical laboratory implementation:

```text
filesystem-backed
content-addressed objects by SHA-256
opaque staged ingressRef
stable logical attachmentId
15-minute staged TTL
retry-safe commit
integrity verification before success
```

Attachment bytes are not carried through Workflow history and are not stored as PostgreSQL binary truth.

## Frozen invariants

1. External channels are replaceable adapters.
2. Durable business orchestration belongs to Temporal.
3. Workflow definitions are channel-independent.
4. Workflow code performs no direct external side effects.
5. Side effects happen through Activities and explicit ports.
6. PostgreSQL/MongoDB/AttachmentStore retain separate authority boundaries.
7. Accepted Workflow state survives CTA loss.
8. Worker process loss does not redefine durable Workflow identity.
9. Exact completed-session replay returns the existing logical execution.
10. Conflicting replay creates no second business effect.
11. Mandatory audit evidence is required before terminal success.
12. Attachment-bearing success requires verified binary commit, PostgreSQL linkage and audit evidence.
13. Integrity mismatch cannot become false success.
14. `RegisterNewCustomer` creates zero scheduling effects.
15. `RegisterNewCustomer` is a specimen, not the final Engines Workflow catalog.

## What mk0 does not claim

- production deployment certification;
- public/internet exposure certification;
- every possible channel adapter;
- final UI/control room;
- Agent/Hermes;
- Scheduler engine;
- Services engine;
- Integration engine;
- every future business Workflow;
- completion of the Engines platform.

## Next transition

The first specimen is no longer blocked by B7.

The next step is to select a **second Engines specimen** and prove that the architecture is genuinely reusable rather than merely successful once.

Candidate future Workflows may include:

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
```

No next specimen is implicitly authorized by mk0 completion. Its contract, authority boundaries, Golden Dataset and quarry protocol should be frozen before implementation.

Current authoritative gate status:

[`Plan/mk0-gate-status.md`](Plan/mk0-gate-status.md)

> **mk0 full local laboratory = system-certified. Golden = 18/18. Physical Postman proof = 37/37. Production and broader Engines remain future work.**
