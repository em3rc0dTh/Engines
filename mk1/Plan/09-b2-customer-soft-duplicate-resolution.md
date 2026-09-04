# Plan 09 — B2 Customer soft-duplicate resolution

Date: 2026-09-04
Status: PLAN FROZEN — BUILD NEXT
Branch: `build/mk1-b2-customer-soft-duplicate-resolution`
Base: `build/mk1-c2-c4-local-interactive-e2e` @ `bc05d3bf1e802d9e1326fcec49986a452feada9f`

## Why this gate exists

Human C2/C4 local E2E testing exposed a real Engine-domain blocker, not a channel bug.

Telegram successfully completed registration, including invalid-phone rejection while preserving the same running Workflow. WhatsApp correctly prefilled the verified sender phone and requested only name + email, but the supplied email matched an existing Customer. The canonical Customer duplicate policy classifies phone/email matches as `SOFT_MATCH`, moving the real `RegisterNewCustomer` Workflow to:

```text
WAITING_FOR_DUPLICATE_DECISION
nextAction = RESOLVE_DUPLICATE
```

The Workflow already exposes that state but has no deterministic Update to resolve it. The local simulator therefore failed closed instead of inventing a Customer decision.

This was already anticipated by Plan 07, which listed `RESOLVE_CUSTOMER_DUPLICATE` as a shared prerequisite. B2 closes only that missing domain capability.

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

## Domain contract

Add a deterministic Workflow Update:

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
2. `inputId` is idempotent. Repeating the same accepted input returns `duplicateInput: true` and creates no second business effect.
3. `USE_EXISTING` requires a candidate Customer selected from the exact candidate set discovered by the Workflow.
4. `CREATE_NEW` explicitly allows the Workflow to continue through the normal Customer creation path; hard-unique constraints remain authoritative.
5. B2 does **not** mutate or merge contact data into an existing Customer. Existing-Customer enrichment is a separate future domain gate.
6. A provider adapter may express only the human decision. Candidate identity selection remains in the transport-independent core/Workflow boundary.
7. For the current messaging slice, `USE_EXISTING` is automatically resolvable only when the Workflow exposes exactly one candidate. Multiple candidates fail closed with a deterministic selection-required error.

## CTA projection

Add render intent:

```text
RESOLVE_CUSTOMER_DUPLICATE
```

Provider presentation may render:

```text
Ya encontramos un cliente con datos coincidentes.
1 Usar el registro existente
2 Crear un registro nuevo
```

Provider callbacks/interactives normalize to the same canonical action:

```text
RESOLVE_CUSTOMER_DUPLICATE
```

No provider-specific duplicate policy is permitted.

## Golden scenarios

### B2-01 — one soft-match candidate → use existing

- seed Customer A;
- start a new registration with a soft-match email or phone;
- reach `WAITING_FOR_DUPLICATE_DECISION`;
- resolve `USE_EXISTING`;
- selected Customer must belong to the discovered candidate set;
- Workflow completes `ALREADY_EXISTS`;
- no second Customer is created.

### B2-02 — one soft-match candidate → create new

- seed Customer A;
- start materially distinct Customer B sharing one soft-match selector;
- resolve `CREATE_NEW`;
- normal hard-unique rules still apply;
- Workflow completes `CREATED` when no hard-unique conflict exists.

### B2-03 — idempotent duplicate-decision replay

- replay same `inputId` after acceptance;
- return `duplicateInput: true`;
- no second completion or persistence effect.

### B2-04 — invalid candidate rejected

- send `USE_EXISTING` with a Customer not in the candidate set;
- reject without leaving `WAITING_FOR_DUPLICATE_DECISION`.

### B2-05 — messaging human regression

- Telegram invalid phone remains rejected without killing Workflow;
- WhatsApp sender phone remains prefilled and not requested again;
- a cross-channel email soft match is presented as a duplicate decision rather than a terminal simulator failure;
- choosing existing completes the same real Temporal Workflow.

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

Only after deterministic runtime proof may we claim:

```text
B2 CUSTOMER SOFT-DUPLICATE RESOLUTION ✅ CERTIFIED
```

C2/C4 local E2E remains only partially human-verified until the WhatsApp duplicate path is retested successfully.
