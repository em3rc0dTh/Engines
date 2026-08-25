# Plan — mk0

## Current planning position

The original pre-Build plan has been executed through B0–B6 and the attachment-free core has passed an integrated Golden gate.

Current truth:

```text
M0–M6 core contracts                  ✅ CLOSED FOR ATTACHMENT-FREE CORE
B0–B6                                 ✅ CERTIFIED
attachment-free Golden               ✅ 14 / 14 PASS
B7 AttachmentStore                    🔒 GATED
attachment Golden                     ⏳ 4 DEFERRED_B7
full mk0                               ⏳ NOT YET COMPLETE
```

Current gate ledger:

[`mk0-gate-status.md`](mk0-gate-status.md)

Integrated core receipt:

```text
../Build/evidence/mk0-core-golden-release-certification-2026-08-25.md
```

B7 project-authority package:

[`b7-attachmentstore-authority-decision.md`](b7-attachmentstore-authority-decision.md)

## mk0 objective

Certify the first reusable Engines architecture pattern without making a channel framework or individual Worker process the durable process authority:

```text
CTA channel
→ CTA Adapter
→ real Temporal Orchestration Engine
→ retry-safe Activities
→ PostgreSQL + MongoDB + AttachmentStore when enabled
```

`RegisterNewCustomer` is the first specimen.

## Closed core plan

The attachment-free build sequence is complete:

```text
B0  runtime/repository skeleton                         ✅ CERTIFIED
B1  canonical contracts + RegistrationPolicy           ✅ CERTIFIED
B2  real Temporal runtime / Task Queue / visibility    ✅ CERTIFIED
B3  CLI CTA Adapter                                     ✅ CERTIFIED
B4  interactive RegisterNewCustomer Workflow           ✅ CERTIFIED
B5  PostgreSQL duplicate/Customer/session Activities   ✅ CERTIFIED
B6  MongoDB mandatory audit + terminal finalization    ✅ CERTIFIED
```

The integrated system gate additionally proved:

- Postman-compatible HTTP CTA through the same canonical adapter;
- exact completed-session replay;
- typed conflicting replay;
- transient PostgreSQL retry;
- CTA process death + fresh-client reconnect;
- multi-round Workflow Updates;
- hard duplicate resolution;
- soft duplicate decision state;
- real Temporal Task Queue/Worker/Event History;
- Worker death after PostgreSQL Customer creation + same-Run recovery;
- zero scheduling side effects.

## Golden status

```text
GD-001 PASS   minimal valid Customer
GD-002 PASS   full Customer
GD-003 DEFERRED_B7   one attachment
GD-004 DEFERRED_B7   multiple attachments
GD-005 PASS   exact completed-session replay
GD-006 PASS   conflicting initial start
GD-007 PASS   invalid structural start
GD-008 PASS   transient PostgreSQL failure/recovery
GD-009 DEFERRED_B7   transient AttachmentStore failure
GD-010 DEFERRED_B7   attachment integrity mismatch
GD-011 PASS   Worker restart after Customer persistence
GD-012 PASS   zero scheduling side effects
GD-013 PASS   CTA disconnect/reconnect
GD-014 PASS   real Temporal runtime proof
GD-015 PASS   intent-only WAITING
GD-016 PASS   multi-round Updates
GD-017 PASS   hard duplicate ALREADY_EXISTS
GD-018 PASS   soft duplicate decision state
```

## Current gate — B7

The next point is no longer a generic Build continuation.

It is an explicit project-authority decision:

```text
PROJECT AUTHORITY B7 DECISION
```

The prepared recommendation is documented in:

```text
b7-attachmentstore-authority-decision.md
```

That package recommends, for the mk0 laboratory only:

```text
filesystem-backed content-addressed AttachmentStore
logical attachmentId separated from SHA-256 blob identity
provider-neutral AttachmentStorePort
small deterministic synthetic fixtures
explicit stage/commit/integrity/TTL/reconciliation contract
```

The recommendation is **not** formal authorization.

## Proposed B7 execution sequence

If project authority explicitly approves B7:

```text
B7.0  authority + physical profile closure
B7.1  commit fixture binaries + freeze SHA-256 / byte lengths
B7.2  AttachmentStore port + filesystem adapter
B7.3  stage / resolve / retrieve / TTL / reconciliation
B7.4  retry-safe commit identity
B7.5  PostgreSQL customer_attachment_refs
B7.6  Temporal attachment Activities + Workflow branch
B7.7  Mongo ATTACHMENT_COMMITTED success gate
B7.8  GD-003 / GD-004 happy certification
B7.9  GD-009 transient failure certification
B7.10 GD-010 permanent integrity-failure certification
B7.11 full 18-case Golden rerun
B7.12 full mk0 certification receipt
```

## B7 success conditions

B7 is not complete merely because files can be saved.

It must prove:

```text
opaque ingressRef
stable attachmentId
SHA-256 + byte-length integrity
no binary in PostgreSQL Customer rows
no binary in Mongo audit
no large binary through normal Workflow History
retry of same ingress → same logical attachment
expired ingress rejected
corruption/hash mismatch detected
orphan/reconciliation candidates observable
Customer finalization waits for every required attachment
ATTACHMENT_COMMITTED audit gates success
```

## Full mk0 stable definition

Full mk0 requires all 18 Golden cases to be accounted for as runtime PASS under the approved profile.

The complete target proof is:

```text
Postman / CLI submits RegisterNewCustomer
→ real Temporal Workflow owns durable session
→ incomplete input waits
→ Updates complete the same Workflow
→ duplicate policy resolves NONE / HARD / SOFT
→ PostgreSQL owns Customer/session truth
→ enabled attachments commit through AttachmentStore
→ PostgreSQL links stable attachment IDs
→ MongoDB has mandatory success-gating audit
→ Worker/CTA loss does not duplicate effects
→ final result is truthful
→ scheduling delta remains zero
→ 18 / 18 Golden cases PASS
```

Only then may the repository call **full mk0 Golden-certified**.

## Explicit boundary

Until B7 approval is recorded:

```text
DO NOT implement AttachmentStore as an authorized stage.
DO NOT mark GD-003/004/009/010 PASS.
DO NOT call full mk0 complete.
```

The attachment-free core, however, is already system-certified and may be treated as the stable laboratory baseline for the next gate.
