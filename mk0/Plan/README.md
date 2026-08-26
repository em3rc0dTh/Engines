# Plan — mk0

## Current planning position

The first Engines laboratory specimen has completed its Build and certification cycle.

Current truth:

```text
M0–M6 architecture/contracts           ✅ CLOSED FOR MK0
B0–B7                                  ✅ CERTIFIED
Golden Dataset                         ✅ 18 / 18 PASS
WSL2 + Docker Compose laboratory       ✅ PHYSICALLY PROVEN
Postman manual certification           ✅ 37 / 37 PASS
full mk0 local laboratory              ✅ SYSTEM_CERTIFIED
production deployment                  ❌ NOT CERTIFIED
broader Engines Workflow Library       ⏳ FUTURE WORK
```

Current gate ledger:

[`mk0-gate-status.md`](mk0-gate-status.md)

Primary current receipt:

```text
../Build/evidence/mk0-full-local-laboratory-certification-2026-08-26.md
```

Historical attachment-free integrated receipt:

```text
../Build/evidence/mk0-core-golden-release-certification-2026-08-25.md
```

Closed B7 authority record:

[`b7-attachmentstore-authority-decision.md`](b7-attachmentstore-authority-decision.md)

## mk0 objective — achieved for the laboratory

mk0 was created to certify the first reusable Engines architecture pattern without making a channel framework, HTTP process or individual Worker the durable business-process authority:

```text
CTA channel
→ CTA Adapter
→ real Temporal Orchestration Engine
→ retry-safe Activities / ports
→ PostgreSQL + MongoDB + AttachmentStore
```

`RegisterNewCustomer` is the first specimen used to prove that pattern.

It is not the final Engines product scope.

## Completed Build sequence

```text
B0  runtime/repository skeleton                         ✅ CERTIFIED
B1  canonical contracts + RegistrationPolicy           ✅ CERTIFIED
B2  real Temporal runtime / Task Queue / visibility    ✅ CERTIFIED
B3  CLI CTA Adapter                                     ✅ CERTIFIED
B4  interactive RegisterNewCustomer Workflow           ✅ CERTIFIED
B5  PostgreSQL duplicate/Customer/session Activities   ✅ CERTIFIED
B6  MongoDB mandatory audit + terminal finalization    ✅ CERTIFIED
B7  AttachmentStore + attachment-bearing registration  ✅ CERTIFIED
```

## Golden status

```text
GD-001 PASS   minimal valid Customer
GD-002 PASS   full Customer
GD-003 PASS   one attachment
GD-004 PASS   multiple attachments
GD-005 PASS   exact completed-session replay
GD-006 PASS   conflicting initial start
GD-007 PASS   invalid structural start
GD-008 PASS   transient PostgreSQL failure/recovery
GD-009 PASS   transient AttachmentStore failure/retry
GD-010 PASS   attachment integrity mismatch / no false success
GD-011 PASS   Worker restart after Customer persistence
GD-012 PASS   zero scheduling side effects
GD-013 PASS   CTA disconnect/reconnect
GD-014 PASS   real Temporal runtime proof
GD-015 PASS   intent-only WAITING
GD-016 PASS   multi-round Updates
GD-017 PASS   hard duplicate ALREADY_EXISTS
GD-018 PASS   soft duplicate decision state

18 / 18 PASS
```

## B7 closure

The former B7 gate is closed.

Approved physical laboratory profile:

```text
Windows + WSL2
Docker Compose
real Temporal
PostgreSQL
MongoDB
filesystem-backed content-addressed AttachmentStore
Postman / localhost HTTP CTA
no tunnel/public exposure
no cloud storage dependency
```

Frozen laboratory limits:

```text
max attachments per registration = 4
max single attachment            = 1 MiB
max total attachment bytes       = 2 MiB
staged ingress TTL               = 15 minutes
integrity hash                   = SHA-256
Golden media types               = image/png, text/plain
```

B7 automated runtime certification:

```text
Source SHA: 80a95d0b9715f91879a9e0cbd7230828098ba997
Run ID:     32896780937
Conclusion: success

GD-003 PASS
GD-004 PASS
GD-009 PASS
GD-010 PASS
```

The 14 core Golden cases were also re-exercised on B7-capable code. Their actual case steps all passed; the historical core job ended red only because its obsolete final pre-B7 assertion required attachments to remain gated.

## Physical operator proof

On 2026-08-26 the full Postman manual-certification collection was executed against the local WSL2/Docker Compose laboratory.

```text
Iterations          1
Duration            2s 668ms
Tests               37
Errors              0
Average response    34 ms
Failed assertions   0
Verdict             37 / 37 PASS
```

The manual proof covered:

- health;
- intent-only Workflow start;
- durable waiting state;
- multiple `ProvideCustomerData` Updates;
- terminal Customer creation;
- exact completed-session replay to the same Workflow/Run;
- typed `SESSION_IDEMPOTENCY_CONFLICT`;
- AttachmentStore stage and resolve;
- registration with an attachment;
- structural CTA rejection;
- typed valid-format missing-ingress `404`.

The supplied final Postman screenshot does not independently display `git rev-parse HEAD`. Exact source provenance therefore remains tied to the source-pinned automated receipts; the screenshot is physical local-operation evidence for the prescribed B7 laboratory profile.

## Stable mk0 definition

The complete certified mk0 pattern is:

```text
Postman / CLI submits RegisterNewCustomer
→ CTA Adapter normalizes the operation
→ real Temporal Workflow owns durable session
→ incomplete input waits
→ Updates complete the same Workflow
→ duplicate policy resolves NONE / HARD / SOFT
→ PostgreSQL owns Customer/session truth
→ attachments stage/commit through AttachmentStore when applicable
→ PostgreSQL links stable attachment IDs
→ MongoDB contains mandatory success-gating audit
→ Worker/CTA loss does not redefine durable execution
→ final result is truthful
→ scheduling delta remains zero
```

## What mk0 completion does not authorize

```text
production deployment
public internet exposure
tunnel/ngrok setup
production object-storage provider selection
final Engines UI/control room
Agent/Hermes
Scheduler
Services Engine
Integration Engine
arbitrary new business Workflows
```

Each of those remains a separate future decision/gate.

## Next project gate

The next point is no longer B7 and is not more work on `RegisterNewCustomer` by default.

The next deliberate decision is:

```text
SELECT SECOND ENGINES SPECIMEN
```

The purpose of the second specimen is to test architectural **reuse**, not merely add another feature to the first specimen.

Before implementation of that specimen, freeze:

```text
1. canonical operation contract
2. authority boundaries
3. Temporal interaction model
4. persistence effects
5. negative/failure semantics
6. quarry protocol
7. Golden Dataset cases
8. Build/certification gates
```

Possible future specimens may include:

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

No candidate is implicitly selected by this document.

> **mk0 planning cycle is closed: full local laboratory = SYSTEM_CERTIFIED. The next planning cycle begins only when the second Engines specimen is explicitly selected.**
