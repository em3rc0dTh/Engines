# mk0 — Gate Status Ledger

## Purpose

This ledger records the **current** mk0 authorization/certification state.

It distinguishes specification, authorization, implementation, runtime proof and system certification.

```text
specified ≠ approved
approved ≠ implemented
implemented ≠ runtime-proven
stage-certified ≠ system-certified
laboratory-certified ≠ production-certified
```

## Current verdict

```text
Architecture contract                  CERTIFIED FOR MK0
Interactive contract                   CERTIFIED
Temporal execution plane               CERTIFIED
PostgreSQL authority                   CERTIFIED
MongoDB mandatory audit                CERTIFIED
AttachmentStore authority              CERTIFIED
CTA death/reconnect                     CERTIFIED
Completed-session replay               CERTIFIED
Transient PostgreSQL retry             CERTIFIED
Post-persistence Worker recovery       CERTIFIED
Hard duplicate                         CERTIFIED
Soft duplicate decision state          CERTIFIED
Scheduling isolation                   CERTIFIED
Golden Dataset                         18 / 18 PASS
WSL2 Docker Compose laboratory         PHYSICALLY PROVEN
Postman manual collection              37 / 37 PASS
Full mk0 laboratory                    SYSTEM_CERTIFIED
Production deployment                  NOT CERTIFIED
Public/external exposure               OUT OF SCOPE
Broader Engines workflow library       NOT IMPLEMENTED BY MK0
```

---

# Authorization history

The original pre-Build approval authorized B0–B6 and intentionally held B7 closed.

Historical records:

```text
mk0/Plan/pre-build-review-2026-08-24.md
mk0/Plan/pre-build-approval-2026-08-24.md
```

B7 was later explicitly authorized for the local WSL2 laboratory profile:

```text
Windows + WSL2
Docker Compose
real Temporal
PostgreSQL
MongoDB
filesystem-backed content-addressed AttachmentStore
Postman / localhost CTA
no cloud dependency
no tunnel/public exposure
```

The B7 physical recommendation and decision package is preserved in:

```text
mk0/Plan/b7-attachmentstore-authority-decision.md
```

The earlier `GATED` state is historical and no longer current.

---

# Current stage ledger

| Stage | Current state | Primary evidence |
|---|---|---|
| M0 reality/source lock | APPROVED / IMPLEMENTED | architecture + Build receipts |
| M1 architecture lock | APPROVED / IMPLEMENTED | CTA → Temporal → Activities authority preserved |
| M2 interactive contract | CERTIFIED | B1/B4 + Golden GD-015/016 |
| M3 Temporal orchestration | CERTIFIED | B2/B4 + GD-014/011 |
| M4 PostgreSQL persistence | CERTIFIED | B5 + GD-008/017 |
| M5 Mongo audit contract | CERTIFIED | B6 mandatory-audit gates |
| M6 Golden Dataset v0 | SYSTEM_CERTIFIED | 18 / 18 accounted PASS |
| B0 | CERTIFIED | runtime skeleton receipt |
| B1 | CERTIFIED | contracts/policy receipt |
| B2 | CERTIFIED | Temporal continuity receipt |
| B3 | CERTIFIED | CLI CTA receipt |
| B4 | CERTIFIED | interactive Workflow receipt |
| B5 | CERTIFIED | PostgreSQL authority receipt |
| B6 | CERTIFIED | Mongo audit/finalization receipt |
| B7 AttachmentStore | CERTIFIED | run `32896780937` + local proof |
| Full mk0 laboratory | SYSTEM_CERTIFIED | automated 18/18 accounting + physical 37/37 Postman proof |

---

# Automated Golden evidence

## Core 14 cases on B7-capable source

Regression source:

```text
609fb09d8d8f5b1229df0e0ebae031a9b5afbb27
```

GitHub Actions run:

```text
32897158566
```

The actual core Golden case steps all completed successfully:

```text
GD-001 PASS
GD-002 PASS
GD-005 PASS
GD-006 PASS
GD-007 PASS
GD-008 PASS
GD-011 PASS
GD-012 PASS
GD-013 PASS
GD-014 PASS
GD-015 PASS
GD-016 PASS
GD-017 PASS
GD-018 PASS
```

The job-level conclusion was `failure` only because the old final pre-B7 meta-assertion expected `ATTACHMENT_BUILD_GATE_CLOSED`. That assertion is deliberately obsolete after B7 and is not interpreted as a product regression.

## B7 attachment cases

Certified B7 source:

```text
80a95d0b9715f91879a9e0cbd7230828098ba997
```

GitHub Actions run:

```text
32896780937
```

Conclusion:

```text
success
```

Cases:

```text
GD-003 PASS  one attachment
GD-004 PASS  multiple attachments
GD-009 PASS  transient AttachmentStore failure / Temporal retry
GD-010 PASS  permanent integrity mismatch / no false success
```

Golden accounting:

```text
attachment-free/core = 14 / 14 PASS
attachment-dependent =  4 /  4 PASS
----------------------------------
TOTAL                = 18 / 18 PASS
unaccounted           =  0
```

---

# Physical local laboratory proof

On 2026-08-26 the operator ran the complete Postman manual-certification collection against the WSL2/Docker Compose laboratory.

Observed Runner receipt:

```text
Iterations          1
Duration            2s 668ms
Tests               37
Errors              0
Average response    34 ms
Failed assertions   0
Verdict             37 / 37 PASS
```

The local proof covered:

```text
health
intent-only start
waiting-state query
multi-round ProvideCustomerData Updates
terminal creation
complete-customer start
exact completed-session replay
SESSION_IDEMPOTENCY_CONFLICT
AttachmentStore stage
AttachmentStore resolve
Customer registration with attachment
CTA 400 structural rejection
typed 404 absent-ingress response
```

Earlier in the same physical laboratory, the operator also supplied direct evidence of:

```text
normal registration       COMPLETED / CREATED
75-byte PNG stage          STAGED / expected SHA-256
attachment registration   COMPLETED / CREATED
Worker                     RUNNING
Task Queue                 engines-mk0-registration
Temporal address           temporal:7233
AttachmentStore root       /data/attachments
```

Durable receipt:

```text
mk0/Build/evidence/mk0-full-local-laboratory-certification-2026-08-26.md
```

The final screenshot does not itself display `git rev-parse HEAD`; therefore exact source provenance for the local screenshot is not inferred from pixels. Exact source authority remains the source-pinned automated receipts, while the Postman run is physical local-operation evidence for the prescribed B7 branch/profile.

---

# What is physically proven now

## Replaceable CTA boundary

CLI and framework-free HTTP/Postman surfaces submit the same canonical operation.

An accepted Workflow is not owned by the initiating CTA process.

Classification:

```text
CTA replaceability / disconnect continuity = CERTIFIED
```

## Interactive durable execution

A legal incomplete start can enter `WAITING_FOR_REQUIRED_DATA` and receive multiple `ProvideCustomerData` Updates within the same Workflow execution.

Classification:

```text
interactive contract = CERTIFIED
```

## Business-scoped replay semantics

```text
same session identity + same initial fingerprint
→ same Workflow ID
→ same Run ID
→ no second business effect

same session identity + different fingerprint
→ SESSION_IDEMPOTENCY_CONFLICT
→ original execution remains authoritative
```

Classification:

```text
completed-session replay/conflict = CERTIFIED
```

## PostgreSQL authority / crash safety

Transient Customer persistence failure retries to one Customer.

Worker death after Customer persistence recovers the same Workflow/Run and does not duplicate the Customer.

Classification:

```text
PostgreSQL authority / retry / recovery = CERTIFIED
```

## Mandatory Mongo audit

Successful terminal registration requires the mandatory audit chain. Exhausted audit failure cannot become false success.

Classification:

```text
mandatory audit-before-success = CERTIFIED
```

## AttachmentStore authority

The local laboratory now has a filesystem-backed content-addressed AttachmentStore behind a provider-neutral port.

Certified semantics include:

```text
stage / resolve / commit
SHA-256 integrity
stable logical attachment identity
content-addressed binary storage
retry-safe commit
PostgreSQL immutable attachment linkage
ATTACHMENT_COMMITTED mandatory audit
staged-ingress TTL
corruption detection
no false terminal success on integrity mismatch
```

Classification:

```text
AttachmentStore B7 = CERTIFIED
```

## Scheduling isolation

`RegisterNewCustomer` creates zero Appointment, ResourceReservation or Availability effects.

Classification:

```text
scheduling isolation = CERTIFIED
```

---

# Current boundary

The repository may now truthfully state:

> **The full mk0 `RegisterNewCustomer` laboratory, including B7 AttachmentStore, is Golden-complete (18/18) and physically proven in local WSL2/Docker Compose through Postman against a real Temporal execution plane.**

It must not overextend this claim into:

```text
production deployment certified       NO
internet/public exposure certified    NO
all future CTA channels certified     NO
all Engines workflows implemented     NO
Engines platform complete             NO
```

---

# Next project gate

B7 is no longer the next gate.

The next deliberate gate is **selection of the next Engines specimen**.

```text
MK0 / RegisterNewCustomer
        ✅ SYSTEM_CERTIFIED LABORATORY
                    ↓
SELECT NEXT SPECIMEN
                    ↓
freeze contract / authority / Golden cases
                    ↓
reuse certified orchestration spine
                    ↓
new Build + certification cycle
```

No next specimen is implicitly authorized merely by mk0 completion. Its scope and Golden contract should be selected explicitly before implementation.
