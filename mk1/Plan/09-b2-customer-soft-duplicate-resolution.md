# Plan 09 — B2 Customer soft-duplicate resolution

Date: 2026-09-04
Status: **✅ CERTIFIED**
Branch: `build/mk1-b2-customer-soft-duplicate-resolution`
Base: `build/mk1-c2-c4-local-interactive-e2e` @ `bc05d3bf1e802d9e1326fcec49986a452feada9f`

## Runtime authority

```text
Certified source  36afff68af3237bd6431fd643d7d969e5452a296
Run               33899907141
Job               101111281727
Artifact          9947248334
SHA-256           2c02680d9e268957924303ab1113d71f0d872319b611a6ede3faca0a01ed678a
```

Receipt: `mk1/Build/evidence/b2-customer-soft-duplicate-resolution-certification-2026-09-04.md`.

## Why this gate exists

Human C2/C4 local E2E testing exposed a real Engine-domain blocker, not a channel bug.

Telegram successfully completed registration, including invalid-phone rejection while preserving the same running Workflow. WhatsApp correctly prefilled the verified sender phone and requested only name + email, but the supplied email matched an existing Customer. The canonical Customer duplicate policy classified that match as `SOFT_MATCH`, moving the real `RegisterNewCustomer` Workflow to:

```text
WAITING_FOR_DUPLICATE_DECISION
nextAction = RESOLVE_DUPLICATE
```

Before B2 the Workflow exposed that state but had no deterministic Update to resolve it. The local simulator therefore failed closed instead of inventing a Customer decision.

Plan 07 had already listed `RESOLVE_CUSTOMER_DUPLICATE` as a shared prerequisite. B2 now closes that missing domain capability.

## Frozen architecture boundary

```text
Provider/CTA choice
      ↓
Canonical RESOLVE_CUSTOMER_DUPLICATE action
      ↓
ChannelExecutionCore
      ↓
Temporal ResolveCustomerDuplicate Update
      ↓
existing RegisterNewCustomer Workflow
      ↓
existing PostgreSQL + Mongo authority
```

The channel never decides duplicate truth. Temporal remains orchestration truth and PostgreSQL remains Customer business truth.

## Certified domain contract

The Workflow now exposes deterministic Update:

```text
ResolveCustomerDuplicate
```

Input:

```ts
{
  inputId: string;
  decision: 'USE_EXISTING' | 'CREATE_NEW';
  customerId?: string;
}
```

Rules:

1. The Update is valid only while `phase === WAITING_FOR_DUPLICATE_DECISION` with a current `SOFT_MATCH` candidate set.
2. The Update implementation maintains an accepted-`inputId` guard; end-to-end certification additionally proves exact canonical duplicate-decision event replay through the durable channel ledger produces no second business effect.
3. `USE_EXISTING` requires a candidate Customer selected from the exact candidate set discovered by the Workflow.
4. `CREATE_NEW` explicitly allows the Workflow to continue through the normal Customer creation path; hard-unique constraints remain authoritative.
5. B2 does **not** mutate or merge contact data into an existing Customer. Existing-Customer enrichment is a separate future domain gate.
6. A provider adapter may express only the human decision. Candidate identity selection remains in the transport-independent core/Workflow boundary.
7. For the current messaging slice, `USE_EXISTING` is automatically resolvable only when the Workflow exposes exactly one candidate. Multiple candidates fail closed with a deterministic selection-required error.

## CTA projection

Certified render intent:

```text
RESOLVE_CUSTOMER_DUPLICATE
```

Provider presentation renders the same deterministic choice:

```text
Ya encontramos un cliente con datos coincidentes.
1 Usar el registro existente
2 Crear un registro nuevo
```

Telegram callbacks and WhatsApp interactives normalize to the same canonical action:

```text
RESOLVE_CUSTOMER_DUPLICATE
```

No provider-specific duplicate policy is permitted.

## Golden scenarios — result

### B2-01 — one soft-match candidate → use existing ✅

- seeded Customer A;
- started a new registration with a soft-match selector;
- reached `WAITING_FOR_DUPLICATE_DECISION`;
- resolved `USE_EXISTING`;
- selected Customer belonged to the discovered candidate set;
- Workflow completed `ALREADY_EXISTS`;
- no second Customer was created.

Marker: `CUSTOMER_B2_USE_EXISTING_PASS`.

### B2-02 — one soft-match candidate → create new ✅

- seeded Customer A;
- started materially distinct Customer B sharing one soft-match selector;
- resolved `CREATE_NEW`;
- normal hard-unique path remained in place;
- Workflow completed `CREATED` with a different Customer ID.

Marker: `CUSTOMER_B2_CREATE_NEW_PASS`.

### B2-03 — exact duplicate-decision event replay ✅

- replayed the same canonical channel event identity and material after acceptance;
- durable channel ledger returned replay;
- no second Workflow/business effect occurred.

Marker: `CUSTOMER_B2_DUPLICATE_DECISION_REPLAY_PASS`.

Note: this runtime marker certifies end-to-end channel-event replay. It does not overclaim that a second direct Temporal Update invocation was executed after terminal completion.

### B2-04 — invalid candidate rejected ✅

- sent `USE_EXISTING` with a Customer outside the candidate set;
- Update rejected it;
- Workflow remained in `WAITING_FOR_DUPLICATE_DECISION / RESOLVE_DUPLICATE`.

Marker: `CUSTOMER_B2_INVALID_CANDIDATE_REJECTED_PASS`.

### B2-05 — messaging cross-channel regression ✅ AUTOMATED / ⏳ HUMAN RETEST

Automated clean run proved:

- Telegram creates Customer;
- WhatsApp sender phone remains prefilled;
- WhatsApp does not ask for phone again;
- same email reaches real `SOFT_MATCH` state;
- duplicate choice is rendered rather than treated as terminal simulator failure;
- `USE_EXISTING` completes the same real Temporal Workflow as `ALREADY_EXISTS`.

The earlier human Telegram run is already verified. The WhatsApp B2 path still requires one human retest on this branch before the combined C2/C4 gate is called HUMAN VERIFIED.

## Failure provenance retained

Full-probe run `33899701530` / job `101110615612` failed because the certification script reused `telegram:message:start` across multiple synthetic conversations. The durable channel ledger correctly rejected that identity collision.

The probe was fixed by scoping synthetic message identity by conversation. No business/runtime invariant changed. Final full authority is run `33899907141` at source `36afff68...`.

## Non-claims

B2 does not certify:

- identity verification beyond the existing duplicate policy;
- automatic contact merge/update into existing Customers;
- multiple-candidate identity adjudication in a consumer-facing channel;
- real Telegram Bot API;
- real Meta/Kapso transport;
- Appointment/Scheduler over messaging;
- Agent/MCP/LLM routing;
- production readiness.

## Certification language

Allowed now:

```text
B2 CUSTOMER SOFT-DUPLICATE RESOLUTION ✅ CERTIFIED
```

Not allowed until the remaining human retest:

```text
C2/C4 local interactive deterministic E2E ✅ HUMAN VERIFIED
```
