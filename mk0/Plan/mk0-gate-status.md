# mk0 — Pre-Build Gate Status Ledger

## Purpose

This ledger answers one question:

> **What is specified, what is formally approved, and what still prevents `Build/` from becoming executable?**

It does not replace Design, Plan, Test or Golden Dataset. It prevents documentation maturity from being mistaken for Build authorization.

Status vocabulary:

```text
SPECIFIED             contract exists and is materially explicit
ALIGNED               known cross-document conflicts are resolved
OPEN                  a required decision/evidence item remains
READY_FOR_APPROVAL    independent pre-Build review found no known contract blocker
APPROVAL_NOT_RECORDED project authority has not yet recorded authorization
BLOCKS_BUILD           Build authorization must not be declared while this remains
BUILD_TIME             intentionally selected during authorized Build, not a pre-Build architecture gap
RUNTIME_GATE           cannot be proven until implementation exists
```

---

## Formal review checkpoint

A formal agnostic pre-Build review is now recorded at:

```text
Plan/pre-build-review-2026-08-24.md
```

Review result:

```text
RECOMMENDATION: READY_FOR_APPROVAL
BUILD AUTHORIZED BY REVIEW: NO
RECOMMENDED FIRST BUILD TICKET: B0
RECOMMENDED ATTACHMENT DISPOSITION: OPTION B / B7 GATED
```

The review found no known unresolved architecture, core Golden Dataset or Test-contract contradiction after the closure pass.

The remaining transition is a **project authority decision**, not another architecture-discovery cycle.

---

## M0 — Reality / source lock

**Status: SPECIFIED / READY_FOR_APPROVAL / APPROVAL_NOT_RECORDED**

Materially present:

- TimeSlots/DataModel Customer source is identified;
- Temporal official documentation is identified as runtime source;
- no-framework project decision is explicit;
- first architecture slice is explicit;
- PostgreSQL/MongoDB/AttachmentStore authority split is explicit;
- evidence classifications exist in `mining-site`.

Open approval evidence:

- no explicit approved Design/source-lock commit is recorded yet.

Build impact:

```text
not an architecture-content blocker
formal approval record is still absent
```

---

## M1 — Architecture lock

**Status: SPECIFIED / ALIGNED / READY_FOR_APPROVAL / APPROVAL_NOT_RECORDED**

Current locked spine:

```text
CTA
→ CTA Adapter
→ Temporal
→ Activities / ports
→ PostgreSQL + MongoDB + optional AttachmentStore
```

Closure fixes now recorded:

- incomplete Customer data may start a legal durable session;
- CTA does not become Customer-completeness authority;
- current/future channel vocabulary was narrowed consistently;
- Build remains framework-neutral.

Open approval evidence:

- architecture approval commit/tag has not been recorded.

---

## M2 — Interactive RegisterNewCustomer contract lock

**Status: SPECIFIED / ALIGNED / READY_FOR_APPROVAL / APPROVAL_NOT_RECORDED**

Specified:

- partial/intent-only start;
- versioned RegistrationPolicy;
- Query `GetRegistrationState`;
- Update `ProvideCustomerData`;
- multi-round collection;
- business-scoped session idempotency;
- initial-start fingerprint vs later Update semantics;
- hard/soft/non-unique duplicate policy;
- CREATED / ALREADY_EXISTS outcomes;
- zero scheduling side effects.

Known contradiction corrected:

```text
old quarry:
missing Customer fields → reject pre-start

current contract:
legal session → Temporal → WAITING_FOR_REQUIRED_DATA when incomplete
```

---

## M3 — Temporal orchestration lock

**Status: SPECIFIED AT ARCHITECTURE LEVEL / READY_FOR_APPROVAL / BUILD_TIME DETAILS REMAIN / APPROVAL_NOT_RECORDED**

Pre-Build invariants are explicit:

- real Temporal Service required;
- real Task Queue / Worker required;
- Workflow/Activity separation required;
- Query/Update semantics required;
- retry/restart durability required;
- CTA disconnect must not destroy accepted state;
- Workflow code cannot perform direct side effects;
- replay/version compatibility is mandatory.

The following are correctly **BUILD_TIME**, not reasons to select a framework or SDK prematurely:

- exact Temporal SDK language/version;
- exact versioning API/mechanism;
- exact retry/backoff numbers;
- exact Activity timeouts/heartbeats;
- exact namespace/topology;
- exact visibility/search-attribute configuration;
- exact payload codec/converter.

### Replay/versioning interpretation

Before Build, mk0 freezes the invariant:

> A deployed Workflow change must preserve deterministic replay/version compatibility for executions whose history was created by an older implementation.

Build must then select and document the SDK-specific mechanism that satisfies that invariant before introducing a non-replay-compatible Workflow change.

---

## M4 — Persistence contract lock

**Status: SPECIFIED / ALIGNED / READY_FOR_APPROVAL / APPROVAL_NOT_RECORDED**

Frozen authority:

```text
PostgreSQL      → Customer + registration/idempotency business truth
MongoDB         → application interaction/audit/context
AttachmentStore → binary/document truth when attachments exist
Temporal        → orchestration/Event History
```

Closure decisions now explicit:

- idempotency scope is `(operation, businessSlug, idempotencyKeyHash)`;
- initial material start snapshot is fingerprinted;
- later `ProvideCustomerData` Updates do not rewrite the start fingerprint;
- mandatory audit milestones gate successful completion;
- audit-store exhaustion cannot become false success.

BUILD_TIME persistence choices:

- exact drivers/ORM/ODM;
- migrations/DDL names;
- database/container topology;
- AttachmentStore physical technology;
- attachment TTL/limits;
- production encryption/backup profile.

---

## M5 — Test contract lock

**Status: SPECIFIED / ALIGNED / READY_FOR_APPROVAL / APPROVAL_NOT_RECORDED**

The Test contract covers:

- legal partial start;
- invalid session start;
- exact replay;
- same-session conflicting initial start;
- cross-business opaque-key isolation;
- Query/Update/multi-round collection;
- duplicate classification;
- PostgreSQL failures;
- MongoDB mandatory-audit failures;
- AttachmentStore failures when enabled;
- Worker restart;
- CTA disconnect/reconnect;
- real Temporal execution;
- zero scheduling side effects.

Runtime proof is intentionally unavailable until Build exists.

Classification: `RUNTIME_GATE` after Build authorization.

---

## M6 — Golden Dataset v0

**Status: SPECIFIED / MACHINE-READABLE / ALIGNED / READY_FOR_APPROVAL / APPROVAL_NOT_RECORDED**

Current machine-readable manifest freezes:

- architecture profile;
- RegistrationPolicy fixture;
- business-scoped idempotency profile;
- initial-start fingerprint profile;
- mandatory audit-success profile;
- GD-001 through GD-018 behavior.

Attachment fixture hashes remain explicitly marked `TO_BE_FROZEN*`.

Recommended disposition from formal review:

```text
OPTION B

B0–B6 may proceed after formal authorization.
B7 remains gated until AttachmentStore technology,
synthetic fixture binaries and SHA-256 expectations are frozen.
```

This keeps attachment behavior inside mk0 without forcing unresolved binary-storage choices to block the core orchestration proof.

---

# Current Build authorization verdict

```text
Architecture content            STRONG / materially specified
Known contract contradictions   corrected in closure pass
Formal pre-Build review         COMPLETE / READY_FOR_APPROVAL
Formal Design approval record   MISSING
Formal Golden approval record   MISSING
Project authority decision      REQUIRED NEXT
Build/README status             NOT AUTHORIZED YET
Runtime evidence                impossible until Build exists
```

Therefore:

> **Do not add production code yet.**

## Next transition

The next point is now exactly:

```text
PROJECT AUTHORITY BUILD-GATE DECISION
```

If approved, the repository records:

```text
approval date
approved repository commit SHA
approved Design package
approved Golden Dataset version
accepted BUILD_TIME deferrals
attachment disposition
first authorized Build ticket = B0
explicit authorization to change Build/README status
```

Only after that record exists does mk0 enter:

```text
B0 — Runtime / Repository Skeleton
```

No approval is asserted by this ledger itself.
