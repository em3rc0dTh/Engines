# B1 — Canonical Contracts + RegistrationPolicy Certification

## Verdict

**B1 CERTIFIED**

Project-local certification date: `2026-08-24`

GitHub Actions certification completed at `2026-08-25T03:54:31Z` (UTC).

B1 certifies the pure/deterministic interaction-contract and policy layer only. It does not certify a production `RegisterNewCustomer` Temporal Workflow, PostgreSQL Customer persistence, MongoDB audit persistence, HTTP/Postman transport or AttachmentStore behavior.

---

## Certified source

```text
Repository:  em3rc0dTh/Engines
Branch:      build/mk0-b1-contracts-policy
Source SHA:  b4c215bbd94b9a68202e815d24c940d91fe14220
B0 parent:   3930ffa3cb708f27d75b89b6c1d6f11bdc1ae2a5
```

Locked installation continues to use the B0-certified `mk0/runtime/package-lock.json` and `npm ci`.

---

## GitHub Actions evidence

```text
Workflow:    mk0 B1 contracts certification
Run ID:      32806902500
Attempt:     1
Conclusion:  SUCCESS
```

Observed successful gates:

```text
Install locked dependencies                 PASS
Type-check runtime                          PASS
B1 contract tests                           PASS
Pure-contract boundary guard                PASS
```

The purity guard confirmed B1 did not introduce:

```text
RegisterNewCustomer production Temporal Workflow
PostgreSQL Customer persistence
PostgreSQL registration-command persistence
MongoDB execution-audit persistence
Postman transport
AttachmentStore implementation
```

---

## Executable contract surface certified

B1 now provides:

```text
RegisterNewCustomer operation/schema constants
Customer draft/contact/document/phone contract types
optional attachment-ingress reference contract
RegisterNewCustomer start envelope
ProvideCustomerData Update input contract
Registration state/result projection types
typed contract validation issues
pure deterministic Customer normalization
pure deterministic Customer patch merge
versioned RegistrationPolicy model
required-field completeness evaluation
duplicate selector/classification model
Golden RegistrationPolicy v1 executable fixture
business-scoped session identity material
normalized initial-start fingerprint material
canonical deterministic serialization
exact-replay/material-conflict comparison helpers
```

B1 intentionally freezes the **material that later boundaries must hash** without introducing crypto/runtime infrastructure into the shared contract layer.

---

## Golden/Test semantics exercised

The B1 tests materially prove the contract-layer portions of the frozen Test/Golden model:

```text
GD-015  intent-only legal start accepted
        → policy reports customer.name + phoneOrEmail missing

GD-007  missing businessSlug rejected pre-Workflow

GD-016  multi-round Customer patches
        → name only remains incomplete
        → later email completes Golden policy requirements

GD-006  same business + same opaque key + materially different initial start
        → same business-scoped session identity
        → different initial fingerprint material

cross-business key reuse
        → different business-scoped session identity

channel / correlation changes
        → excluded from initial-start fingerprint material
```

Additional certified behavior:

- malformed operation/idempotency/schema envelopes are rejected;
- missing Customer business-completeness fields do not become CTA/start validation failures;
- email/document/phone normalization is deterministic;
- phone/attachment collection ordering does not produce fingerprint drift;
- attachment integrity metadata is structurally validated when present without making attachments universally required;
- document and attachment requirements can be enabled by policy rather than hard-coded globally;
- Golden duplicate policy preserves document composite as `HARD_UNIQUE`, phone/email as `SOFT_MATCH`, and name as `NON_UNIQUE`;
- `ProvideCustomerData` requires stable `inputId` and structural Customer patch.

---

## First failure retained as evidence

The first B1 CI run did **not** pass.

```text
Run ID:      32806780515
Failure:     TypeScript type-check
```

A diagnostic run then retained the exact compiler evidence:

```text
Run ID:      32806837607
Artifact ID: 9548428581
Artifact digest:
sha256:b8d068c98197c789f184f7e74257a928dbfb3622623f49caa6ebd643bcf6995b
```

Cause:

> `Object.freeze(...)` widened literal arrays in the Golden policy fixture to `string[]`, violating the intentionally narrow `RequiredRegistrationField` union.

Resolution:

```text
as const satisfies RegistrationPolicy
```

No union was widened and strict TypeScript settings were not relaxed.

The next certification run passed completely.

---

## Authority preserved

B1 does not move authority out of the approved architecture:

```text
CTA/start validation   → structural/session legality only
RegistrationPolicy     → business completeness + duplicate-rule configuration
Temporal               → later durable orchestration authority
PostgreSQL             → later Customer/registration business truth
MongoDB                → later mandatory application audit/context
AttachmentStore        → still B7 gated
```

No scheduling model was introduced.

---

## B1 closure

Acceptance requirements are satisfied:

```text
canonical contract types             PASS
pure normalization                   PASS
versioned RegistrationPolicy         PASS
policy-driven required fields        PASS
duplicate-rule representation        PASS
business-scoped session material     PASS
initial-start fingerprint material   PASS
Golden-oriented contract tests       PASS
strict TypeScript                    PASS
locked dependency installation       PASS
no premature side effects            PASS
```

Therefore:

> **B1 — Canonical Contracts + Versioned RegistrationPolicy = CERTIFIED.**

Next authorized stage:

> **B2 — Real Temporal Runtime Topology + Visibility / Continuity Proof**

B7 AttachmentStore remains gated.
