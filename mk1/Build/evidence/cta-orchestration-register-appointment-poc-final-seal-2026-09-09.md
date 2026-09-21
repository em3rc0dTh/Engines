# CTA Orchestration Register Appointment PoC — final evidence seal

Date: 2026-09-09
Repository: `em3rc0dTh/Engines`
Branch: `feature/cta-orchestration-register-appointment-poc`
Draft PR: `#24 — CTA orchestration: canonical Register Appointment PoC`

## Code candidate

Physical final WebChat regression was executed against code candidate:

- `2f15e2a741ba6cf0a677a69e33711e961cca8c10`

Fresh PR CI on that exact code candidate:

- CTA Orchestration Appointment PoC — run `34361546715` — PASS
  - artifact `cta-orchestration-poc-34361546715`
  - digest `sha256:4344db92a2e8068addcc51e3d720da9d4fb613410784ea4f62f159a7967f82fa`
- MK1 C2 Telegram Official Bot API Transport — run `34361546659` — PASS
  - artifact `mk1-c2-telegram-official-34361546659`
  - digest `sha256:5f189fe7343cb5dc84e949ee1144094ff2047f0cddb0e726c2fd9d9c259bb114`
- MK1 C4P Kapso Official WhatsApp Transport — run `34361546768` — PASS
  - artifact `mk1-c4p-kapso-34361546768`
  - digest `sha256:1877a2119a21cd6a7c19aa59e4ac9fe972b0342f2c35f06205ce9f8cb923bb1f`

The branch may move after this code candidate only for evidence/documentation updates. Those documentation commits do not invalidate the physical code-candidate evidence.

## Certified architecture boundary

```text
provider-specific adapter boundary
  -> canonical channel envelope / CanonicalCTAEvent
  -> CTA ingress provenance + idempotency
  -> Temporal RegisterNewAppointment
  -> Customer / ManagedEntity / Case
  -> Appointment
  -> ResourceReservation
  -> Operational Timeline
  -> terminal CTA + channel-binding reconciliation
```

Provider parsing/auth remains at the provider boundary. Provider outputs converge on the same Register Appointment orchestration path. No provider-specific business workflow is introduced.

## P1 — WebChat physical certification

Original physical WebChat certification proved a real browser flow through channel-core, canonical CTA, Temporal and PostgreSQL. Exact start-event replay returned the same logical workflow graph with no duplicate Case, Appointment or Reservation.

Original certified identities:

- workflow `register-appointment:golden-business:ebbe4959f906ca0c382dcbffe715f035`
- Appointment `apt_910686b8-3d63-432c-bd34-006630616308`
- Case `case_4e014b41-5a75-446e-8bd2-9faf28e05b36`
- ResourceReservation `rr_f60c5b49-637a-4e04-aa41-c83f0d2e064e` — `BOOKED`
- CTA ingress `cta_80e59dd777d951cce9a23340c4ad9f405fa0805c9ee20b0254e6e941665f1474` — `COMPLETED`
- exact replay `replayed=true`, `duplicate_count=1`
- one Appointment, one Case, one Reservation after replay

### Final WebChat regression on `2f15e2a...`

A second real browser run completed end to end after all Telegram/WhatsApp lifecycle changes and the WEBCHAT-ST01 code fix.

Certified identities:

- conversation `webchat-conversation-e600fe7a-096a-481b-b16e-c0edab632ba1`
- workflow `register-appointment:golden-business:d17ee5ee5d5eafedbd2a4d850ae286de`
- Temporal run `01a08683-6845-7154-ba7f-88eb82d4df77`
- Appointment `apt_fdd03d05-3cc1-4323-a0ff-14394fd1a4cf`
- Customer `cus_8fafea8a-275a-44a3-8b9e-eea17ceaf9cc`
- ManagedEntity `men_f4aa131f-8e2f-487f-8789-d383d0c09056`
- Case `case_ce273b25-df95-4d17-a99b-5209a48b0d34`
- ResourceReservation `rr_8a91ea16-8e60-4b6f-b176-fc9fb74a1938`
- Service `svc_car_wash`
- Offering/Product `prd_car_wash_executive` (`Executive Clean`)
- appointment date `2026-09-10`
- slot `07:00–07:30`

Observed terminal state:

```text
workflowStatus = COMPLETED
phase          = CREATED
nextAction     = NONE
bindingStatus  = COMPLETED
```

All twelve WebChat workflow-map steps were `COMPLETE`, including finalization and Appointment Created. The separate Temporal Workflow Inspector independently showed the same workflow id, run id, completed state and business projection.

Input validation also remained active: an invalid date input was rejected with `INVALID_DATE` before a valid human weekday input advanced to slot selection.

This final run is stronger than the requested short smoke because it completed the full appointment flow.

## P2 — Telegram physical certification

Real Telegram app -> official Bot API -> Engines runner -> canonical CTA -> Temporal -> PostgreSQL completed successfully.

Certified identities:

- provider event `telegram:update:974290101`
- external conversation `telegram:1589599355`
- workflow `register-appointment:golden-business:1b038e5bd85758f545010271b805c035`
- Appointment `apt_1cf266e8-ff46-4b65-928e-8a34f36fde49`
- Case `case_27087ad0-b859-4597-8544-95655a64d70c`
- Reservation `rr_cd6f787b-2240-434b-8604-994e721f3674` — `BOOKED`
- CTA ingress `COMPLETED`

Exact normalized replay returned the same workflow / Case / Appointment and incremented `duplicate_count` to 1 while preserving exactly one Appointment, one Case and one Reservation.

Physical regression also proved:

- name + email + phone capture before customer resolution;
- no user-facing `Continuar` for internal customer resolution;
- completed appointment can be followed by a new `/appointment` in the same Telegram chat;
- distinct sequential workflows and Appointment ids in one provider conversation.

## P3 — WhatsApp / Kapso physical certification

Real WhatsApp -> Kapso signed webhook -> Engines live runner -> canonical CTA -> Temporal -> PostgreSQL completed successfully.

Certified identities:

- provider event `whatsapp:message:wamid.HBgLNTE5MzMwNzUyMDAVAgASGBYzRUIwNDgwOTY2MjY0N0RCRkU4OEYwAA==`
- external conversation `whatsapp:d9f75920-b18f-43b8-bec8-aa65c494ba31`
- workflow `register-appointment:golden-business:604069189f45f508ace069c8f994b3c3`
- Appointment `apt_b1d89420-9aab-4a2e-bf44-d0e8319ac8fb`
- Case `case_be7f10dd-f727-424f-b96a-b230d8540905`
- Reservation `BOOKED`
- CTA ingress `cta_29c4cd0d68a03e59b839be7ee65b212521529da31645622cf02f8fc0443142ff`

Physical testing exposed a terminal-render race: `phase=CREATED` was observable while `workflowStatus=RUNNING`, allowing success rendering before CTA/binding reconciliation. The code candidate fixed this by treating `CREATED/RUNNING` as non-terminal and only rendering success after durable `COMPLETED`.

The same physical Appointment was then reconciled to:

```text
CTA ingress status = COMPLETED
binding status     = COMPLETED
```

Exact signed Kapso webhook redelivery produced `EVENT_RECEIVED` and:

```text
duplicate_count = 1
appointments_for_workflow = 1
cases_for_workflow = 1
reservations_for_workflow = 1
reservation_status = BOOKED
```

Therefore P3 physical delivery, persistence/provenance and replay/idempotency are certified.

## WEBCHAT-ST01

The stale-browser-state defect is fixed in code and covered by a deterministic regression test on code candidate `2f15e2a...`.

The browser now treats `404 CHANNEL_CONVERSATION_NOT_BOUND` as a recoverable stale session and:

- clears `engines.webchat.conversationId` from localStorage;
- clears browser projection state;
- removes stale `conversationId` and `workflowId` URL parameters;
- preserves unrelated query parameters;
- re-enables `Start Workflow`;
- allows a fresh durable conversation without requiring Incognito or manual localStorage cleanup.

### Physical-evidence boundary

The final uploaded WebChat artifacts prove a fresh normal appointment run on the fixed candidate, but they do **not** contain the stale-session recovery message or URL/localStorage transition. Therefore this receipt does not falsely claim a physical WEBCHAT-ST01 recovery observation.

The code/test gate is PASS. A one-minute physical stale-session recovery observation remains optional if the merge policy requires physical evidence for this browser-recovery defect rather than deterministic regression coverage.

## Observed WebChat PoC UX

The final browser PoC still exposes an explicit `Resolve Customer` engineering step. This does not invalidate the orchestration/persistence certification, but it should not be interpreted as the desired end-customer UX. Telegram physical UX already proves the internal customer-resolution step can be automatic.

## Gate status

```text
P1 WebChat physical path + persistence + replay     PASS
P2 Telegram physical path + persistence + replay    PASS
P3 WhatsApp/Kapso physical path + persistence       PASS
P3 signed replay / idempotency                      PASS
Telegram sequential appointments                    PASS
Terminal CTA/binding reconciliation                 PASS
WEBCHAT-ST01 code + regression test                  PASS
Final WebChat full regression on code candidate      PASS
WEBCHAT-ST01 physical recovery observation           NOT DIRECTLY EVIDENCED
```

## Truth boundary

This seal certifies the Register Appointment PoC slice only. It does not claim AI Agent, MCP, full Services Engine, full Scheduler Engine, production readiness, universal provider certification, or release readiness.

Messenger, Facebook Comments and TikTok physical provider delivery are outside the selected physical gate set for this first PoC.

## Merge state

PR #24 must remain unmerged until explicit user authorization. Whether to require the optional physical WEBCHAT-ST01 recovery observation before marking the PR ready for review is a merge-policy decision; this receipt keeps that distinction explicit.
