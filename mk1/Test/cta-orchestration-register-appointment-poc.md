# CTA Orchestration Register Appointment PoC — pre-merge test contract

Status: PRE-MERGE TESTING
Branch: `feature/cta-orchestration-register-appointment-poc`
Draft PR: #24

## Deterministic receipt

Command:

```bash
cd mk1/runtime
npm run check
find src -name '*.test.ts' -print0 | xargs -0 node --import tsx --test
```

Observed baseline on 2026-09-08:

```text
TypeScript: PASS
Tests:      124
Passed:     124
Failed:     0
```

Coverage includes:

- compatibility boundary preserving existing channel adapters;
- WebChat, Telegram, WhatsApp and API convergence on `register_appointment`;
- Messenger, Facebook Comment and TikTok convergence on the same canonical contract;
- Meta and TikTok authentication/signature failures fail closed;
- duplicate canonical ingress starts one logical operation;
- CatalogOffering compatibility derives legacy Service/Product relationships internally;
- inherited regression tests remain green.

## Current clean-stack candidate

Candidate implementation SHA:

`712a283b12df10174607c7af1c5fce97dcfcb6c8`

CTA orchestration run:

`34250211810` — PASS

Artifact:

`cta-orchestration-poc-34250211810`

Digest:

`sha256:8912bb6bbc5c879762529b72f599543320be9d36e7eff69999b78bc471f7a1fe`

The clean-stack gate proves:

```text
API CTA
 -> CanonicalCTAEvent
 -> CTAIngressRecord
 -> Temporal RegisterNewAppointment
 -> CatalogOffering compatibility
 -> ResourceReservation HELD
 -> Customer / ManagedEntity / Case
 -> Appointment + TimelineEvent
 -> ResourceReservation BOOKED
 -> CTAIngressRecord COMPLETED
```

The exact start event is replayed and remains one logical graph (`duplicate_count = 1`).

A second workflow is deliberately forced to fail after capacity is held. The strict gate now proves both:

```text
ResourceReservation HELD -> RELEASED
CTAIngressRecord PROCESSING -> FAILED
```

with a terminal error code persisted.

## Existing transport regression gates

### Telegram

Run `34250211804` — PASS.

Assertions:

- Telegram Bot API deterministic client contract passes;
- Telegram adapter regression passes;
- clean Engines infrastructure boots;
- existing real-Temporal Telegram regression passes.

This is transport/runtime regression evidence, not a new live provider-event certification.

### WhatsApp / Kapso

Run `34250211792`, attempt 2 — PASS.

Assertions:

- Kapso v2 deterministic contract tests pass;
- WhatsApp adapter regression passes;
- clean Engines infrastructure boots;
- existing real-Temporal WhatsApp regression passes;
- deterministic Kapso runner boots and evidence is captured.

Attempt 1 failed only during Docker/BuildKit runner boot (`rpc ... EOF`). The unchanged rerun passed every step, so the first result is classified as an infrastructure/build flake rather than a demonstrated adapter/orchestration regression.

This remains deterministic/local transport evidence, not a new live WhatsApp provider event.

## Physical-provider pre-merge matrix

A physical gate is PASS only when a real provider event is received from provider infrastructure and the resulting canonical/business provenance is captured.

| Channel | Adapter/contract | Clean-stack/runtime | New live provider event | Physical merge gate |
|---|---|---|---|---|
| WebChat | PASS | PASS | OPEN browser/endpoint smoke | OPEN |
| Telegram | PASS | PASS | OPEN if selected for merge | OPEN |
| WhatsApp | PASS | PASS | OPEN if selected for merge | OPEN |
| Messenger | PASS contract | PASS deterministic | OPEN app/webhook/event | OPEN |
| Facebook Comments | PASS contract | PASS deterministic | OPEN Page webhook/comment event | OPEN |
| TikTok | PASS contract | PASS deterministic | OPEN / capability dependent | OPEN |
| API | PASS | PASS | canonical smoke PASS | PASS for PoC |

## Live provider acceptance contract

For each provider selected as a physical merge gate, capture:

```text
provider event received
signature/authentication verified where applicable
provider event id
external user/conversation id
CanonicalCTAEvent persisted
CTAIngressRecord persisted
Temporal workflow id
Customer resolved/created
ManagedEntity resolved/created
Case persisted
Appointment persisted
ResourceReservation BOOKED
Timeline/audit persisted
provider provenance retained
```

Then replay the exact same real provider event and prove:

```text
same logical operation
same Appointment
no second Case
no second Appointment
no second ResourceReservation
```

At least one invalid authentication/signature event must fail closed where the provider exposes signed webhooks.

## Merge rule

Do not merge solely because deterministic and clean-stack tests are green.

PR #24 remains Draft until:

1. selected physical-provider gates are executed or explicitly deferred with truthful scope;
2. their evidence is stored/referenced;
3. final review confirms no claims exceed the evidence;
4. the final candidate CI is green.

## Non-claims

This test contract does not certify new live Meta, TikTok, Telegram or WhatsApp delivery. It does not certify production readiness, Services Engine completion or Scheduler Engine completion.
