# mk0 — Gate Status Ledger

## Purpose

This ledger records the **current** mk0 authorization/certification state.

It is not a substitute for Design, Test, Golden Dataset or runtime evidence. Its purpose is to prevent one class of truth from being mistaken for another:

```text
specified ≠ approved
approved ≠ implemented
implemented ≠ runtime-proven
stage-certified ≠ system-certified
attachment-free certified ≠ full mk0 certified
```

## Status vocabulary

```text
SPECIFIED        contract is materially explicit
APPROVED         project authority authorized the stated scope
IMPLEMENTED      executable implementation exists
CERTIFIED        identified runtime evidence satisfies the stated gate
SYSTEM_CERTIFIED integrated Golden/runtime proof exists across stage boundaries
GATED            explicit authorization/preconditions still block entry
DEFERRED_B7      Golden case belongs to the still-gated attachment stage
```

---

# Historical Build authorization

The pre-Build architecture was formally reviewed and the staged Build was authorized through B0–B6 with B7 deliberately held closed.

Authoritative records:

```text
mk0/Plan/pre-build-review-2026-08-24.md
mk0/Plan/pre-build-approval-2026-08-24.md
```

Authorized staged envelope:

```text
B0  runtime/repository skeleton
B1  canonical contracts + RegistrationPolicy
B2  Temporal runtime/topology
B3  CLI CTA Adapter
B4  interactive RegisterNewCustomer Workflow
B5  PostgreSQL Activities
B6  MongoDB mandatory audit Activities

B7  AttachmentStore → NOT AUTHORIZED BY THAT RECORD
```

The old pre-Build state is therefore historical, not the current gate position.

---

# Current stage ledger

| Stage | Current state | Evidence |
|---|---|---|
| M0 reality/source lock | APPROVED / IMPLEMENTED | approved architecture package + Build receipts |
| M1 architecture lock | APPROVED / IMPLEMENTED | CTA → Temporal → Activities authority preserved |
| M2 interactive contract | APPROVED / CERTIFIED | B1/B4 + integrated Golden GD-015/016 |
| M3 Temporal orchestration | IMPLEMENTED / CERTIFIED | B2/B4 + integrated GD-014/011 |
| M4 PostgreSQL persistence | IMPLEMENTED / CERTIFIED | B5 + integrated GD-008/017 |
| M5 Mongo audit contract | IMPLEMENTED / CERTIFIED | B6 + integrated success/failure gates |
| M6 Golden Dataset v0 | PARTIALLY SYSTEM_CERTIFIED | 14 attachment-free PASS; 4 DEFERRED_B7 |
| B0 | CERTIFIED | runtime skeleton receipt |
| B1 | CERTIFIED | contracts/policy receipt |
| B2 | CERTIFIED | Temporal continuity receipt |
| B3 | CERTIFIED | CLI CTA receipt |
| B4 | CERTIFIED | interactive Workflow receipt |
| B5 | CERTIFIED | PostgreSQL authority receipt |
| B6 | CERTIFIED | Mongo audit/finalization receipt |
| Integrated attachment-free core | SYSTEM_CERTIFIED | run `32873848134` |
| B7 AttachmentStore | GATED | technology + fixture/hash closure required |
| Full mk0 Golden | OPEN AFTER B7 | GD-003/004/009/010 remain |

---

# Integrated attachment-free Golden certification

The system-level gate ran the complete currently-applicable Golden matrix against a real runtime.

```text
Golden Dataset:  mk0.golden.register-customer.v0
Source SHA:      f0896c58d918e8f3971c78867870243e16a8b604
Run ID:          32873848134
Job ID:          97886979323
Artifact ID:     9573135809
Artifact:        mk0-core-golden-release-32873848134
Digest:          sha256:25fea20c892ea7cd758788ac63a53ba9048b8809599f2b972c5ef77942c2b4e8
Verdict:         ATTACHMENT_FREE_CORE_GOLDEN_PASS
```

Durable receipt:

```text
mk0/Build/evidence/mk0-core-golden-release-certification-2026-08-25.md
```

Golden status:

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

Therefore:

```text
attachment-free applicable cases = 14 / 14 PASS
attachment-dependent cases        = 4 / 4 explicitly deferred
unaccounted Golden cases          = 0
```

---

# What is now physically proven

## Replaceable CTA boundary

Both CLI and a Postman-compatible framework-free HTTP adapter can submit the canonical registration operation.

The HTTP CTA process can be killed after Workflow acceptance without destroying the Temporal execution. A fresh client can query and update the same Workflow/Run.

Classification:

```text
CTA replaceability / disconnect continuity = CERTIFIED
```

## Business-scoped session replay

The integrated gate proved completed-session replay, not only running-session behavior.

```text
same identity + same initial fingerprint
→ same Workflow ID
→ same Run ID
→ no second registration
→ no second Customer

same identity + different initial fingerprint
→ SESSION_IDEMPOTENCY_CONFLICT
→ original execution remains authoritative
```

Classification:

```text
start replay/conflict semantics = CERTIFIED
```

## Interactive waiting / Updates

Intent-only start reaches `WAITING_FOR_REQUIRED_DATA` under the versioned RegistrationPolicy.

Multiple `ProvideCustomerData` Updates evolve the same durable execution until completeness is satisfied.

Classification:

```text
interactive contract = CERTIFIED
```

## PostgreSQL retry / duplicate authority

The integrated gate injected a transient first-attempt `createCustomer` failure. Temporal retried and exactly one Customer resulted.

Hard duplicate resolved an existing Customer without a second Customer row.

Soft duplicate remained `WAITING_FOR_DUPLICATE_DECISION`.

Classification:

```text
PostgreSQL business authority / retry safety = CERTIFIED
```

## Mandatory Mongo audit

B6 already proved mandatory audit is required before success and that exhausted Mongo failure after Customer persistence becomes typed `MONGO_AUDIT_STORE_UNAVAILABLE` rather than false success.

The integrated core gate reconfirmed successful terminal paths with required audit evidence.

Classification:

```text
mandatory audit-before-success = CERTIFIED
```

## Worker loss after a real business side effect

GD-011 delayed `CUSTOMER_CREATED` audit after PostgreSQL Customer creation, observed `CUSTOMER_CREATED_PENDING_AUDIT`, killed that Worker, and started a new Worker.

```text
Delayed Worker PID:   5689
Recovery Worker PID:  6120
Workflow ID:          register-customer:golden-business:427a35365ca5875145b397e2b7f391ce
Run ID:               01a039d0-cadf-7dc8-bf39-e3703c2c8c86
Final Customer count: 1
Final registration:   COMPLETED_CREATED
```

Classification:

```text
post-side-effect Worker recovery = CERTIFIED
```

## Scheduling isolation

The `RegisterNewCustomer` runtime creates no Appointment, ResourceReservation or Availability effects.

Classification:

```text
scheduling isolation = CERTIFIED
```

---

# Current B7 gate

B7 remains intentionally closed.

Before Build entry, project authority must freeze at minimum:

```text
1. AttachmentStore physical technology
2. synthetic attachment binary fixtures
3. expected SHA-256 values
4. ingress staging identity and resolution contract
5. commit/retry/idempotency semantics
6. size/count limits
7. TTL / expiry behavior
8. corruption/hash-mismatch behavior
9. retrieval/streaming proof expectations
10. orphan/reconciliation expectations
```

The four Golden cases blocked by that gate are exactly:

```text
GD-003 one attachment
GD-004 multiple attachments
GD-009 transient AttachmentStore failure
GD-010 permanent attachment integrity mismatch
```

No other Golden case is currently blocked.

---

# Current project verdict

```text
Architecture contract                    CERTIFIED THROUGH CORE
Interactive contract                     CERTIFIED
Temporal execution plane                 CERTIFIED
PostgreSQL authority                     CERTIFIED
MongoDB mandatory audit                  CERTIFIED
CTA death/reconnect                      CERTIFIED
Completed-session replay                 CERTIFIED
Transient PostgreSQL retry               CERTIFIED
Post-persistence Worker recovery         CERTIFIED
Hard duplicate                           CERTIFIED
Soft duplicate decision state            CERTIFIED
Scheduling isolation                     CERTIFIED
Attachment-free Golden Dataset           14 / 14 PASS
Attachment Golden Dataset                0 / 4 — DEFERRED_B7
Attachment-free mk0 core                 SYSTEM_CERTIFIED
Full mk0                                 NOT YET COMPLETE
B7                                       GATED
Production deployment                    NOT CERTIFIED
```

The repository may now truthfully state:

> **The attachment-free mk0 `RegisterNewCustomer` core is integrated-Golden certified and release-ready as a laboratory core.**

It may not yet state that full mk0 is complete.

---

# Next transition

The next project gate is now exactly:

```text
PROJECT AUTHORITY B7 DECISION
```

If B7 is authorized after its physical storage/fixture closure:

```text
B7 AttachmentStore implementation
       ↓
GD-003 / GD-004 / GD-009 / GD-010 runtime certification
       ↓
complete 18 / 18 Golden accounting
       ↓
FULL MK0 GOLDEN CERTIFICATION
```

Until that decision is explicitly recorded:

```text
DO NOT claim AttachmentStore runtime support.
DO NOT mark GD-003/004/009/010 PASS.
DO NOT call full mk0 complete.
```
