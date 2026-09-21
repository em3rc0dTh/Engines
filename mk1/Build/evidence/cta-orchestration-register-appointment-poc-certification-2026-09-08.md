# CTA Orchestration Register Appointment PoC — pre-merge certification receipt

Date: 2026-09-09
Repository: `em3rc0dTh/Engines`
Branch: `feature/cta-orchestration-register-appointment-poc`
PR: `#24 — CTA orchestration: canonical Register Appointment PoC`

## Current candidate

Code candidate used for the final physical WebChat regression and stale-session recovery proof:

- Code candidate: `2f15e2a741ba6cf0a677a69e33711e961cca8c10`
- Later branch commits are evidence/documentation-only.
- PR state at seal time: open, mergeable, unmerged.

Fresh CI on `2f15e2a741ba6cf0a677a69e33711e961cca8c10`:

- `CTA Orchestration Appointment PoC` — run `34361546715` — **PASS**
  - artifact `cta-orchestration-poc-34361546715`
  - digest `sha256:4344db92a2e8068addcc51e3d720da9d4fb613410784ea4f62f159a7967f82fa`
- `MK1 C2 Telegram Official Bot API Transport` — run `34361546659` — **PASS**
  - artifact `mk1-c2-telegram-official-34361546659`
  - digest `sha256:5f189fe7343cb5dc84e949ee1144094ff2047f0cddb0e726c2fd9d9c259bb114`
- `MK1 C4P Kapso Official WhatsApp Transport` — run `34361546768` — **PASS**
  - artifact `mk1-c4p-kapso-34361546768`
  - digest `sha256:1877a2119a21cd6a7c19aa59e4ac9fe972b0342f2c35f06205ce9f8cb923bb1f`

CI transport jobs are deterministic/runtime evidence. Physical provider claims below are based on separately observed real browser/provider runs.

## Certified architecture

```text
proven provider adapter boundary
  -> canonical channel envelope
  -> CanonicalCTAEvent
  -> CTAIngressRecord
  -> Temporal RegisterNewAppointment
  -> CatalogOffering compatibility
  -> Customer / ManagedEntity / OperationalCase
  -> Appointment
  -> ResourceReservation BOOKED
  -> Operational TimelineEvent
  -> CTAIngressRecord COMPLETED
```

Failure compensation remains certified:

```text
ResourceReservation HELD -> RELEASED
CTAIngressRecord PROCESSING -> FAILED
```

## Lifecycle / UX fixes closed

### TG-UX01 — appointment contact completeness

Appointment auto-resolution uses `GOLDEN_REGISTRATION_POLICY_V2`, requiring:

```text
name + phone + email
```

Telegram no longer exposes a meaningless manual `Continuar` step for internal customer resolution.

### TG-LC01 — stale binding after Temporal dev-server reset

Telegram detects Temporal workflow-not-found instead of polling a dead binding forever. The stale binding is reconciled terminally and a later `/appointment` can safely create a fresh workflow in the same chat.

### Channel binding lifecycle

```text
ACTIVE -> COMPLETED | FAILED
terminal binding + new workflow -> ACTIVE rebinding
```

### CTA-LC01 — multiple appointments in one provider conversation

CTA terminal reconciliation is scoped by both correlation and authoritative `workflow_id`, preventing one appointment from reconciling an older ingress merely because both share the same provider conversation.

### WA-LC01 — terminal render/reconciliation race

Physical WhatsApp testing exposed a state where `phase=CREATED` could be visible while `workflowStatus=RUNNING`. That allowed a provider runner to render success before CTA ingress and binding reconciliation.

The candidate treats `CREATED/RUNNING` as non-terminal and only surfaces success after durable `COMPLETED`. The same guard is applied to Telegram.

### WEBCHAT-ST01 — stale browser session recovery

The WebChat browser recognizes `404 CHANNEL_CONVERSATION_NOT_BOUND` as a recoverable stale-session condition. It clears the stale persisted conversation identity, removes stale `conversationId`/`workflowId` URL parameters, resets the projection and re-enables `Start Workflow` while preserving unrelated query parameters.

This was regression-tested in code and then physically exercised in the browser with persisted identity:

```text
webchat-conversation-stale-cert
```

Observed physical recovery:

```text
CTA + channel ready · previous conversation expired
Workflow = not started
Status = —
Temporal phase = —
Next action = —
Previous durable conversation webchat-conversation-stale-cert is no longer available.
Start Workflow to begin a new conversation.
```

`Start Workflow` was re-enabled automatically and the raw durable state reset to `No Workflow state yet.` No Incognito window, manual localStorage cleanup, SQL deletion or backend-volume reset was required.

Therefore `WEBCHAT-ST01` is **PHYSICALLY CLOSED**.

## Physical evidence — P1 WebChat

### Original physical certification

A real browser WebChat run proved the actual browser path through the canonical appointment architecture.

- Workflow: `register-appointment:golden-business:ebbe4959f906ca0c382dcbffe715f035`
- Appointment: `apt_910686b8-3d63-432c-bd34-006630616308`
- Case: `case_4e014b41-5a75-446e-8bd2-9faf28e05b36`
- ResourceReservation: `rr_f60c5b49-637a-4e04-aa41-c83f0d2e064e`
- Reservation status: `BOOKED`
- CTA ingress: `cta_80e59dd777d951cce9a23340c4ad9f405fa0805c9ee20b0254e6e941665f1474`
- CTA status: `COMPLETED`
- Timeline: `APPOINTMENT_REGISTERED`

Exact start-event replay returned:

```text
replayed = true
duplicate_count = 1
appointments = 1
cases = 1
reservations = 1
```

### Final WebChat physical regression on `2f15e2a...`

The final code candidate was exercised again in a real browser through the entire appointment flow.

- Workflow: `register-appointment:golden-business:d17ee5ee5d5eafedbd2a4d850ae286de`
- Run: `01a08683-6845-7154-ba7f-88eb82d4df77`
- Conversation: `webchat-conversation-e600fe7a-096a-481b-b16e-c0edab632ba1`
- Channel operation: `RegisterNewAppointment`
- Binding status: `COMPLETED`
- Workflow status: `COMPLETED`
- Temporal phase: `CREATED`
- Customer: `cus_8fafea8a-275a-44a3-8b9e-eea17ceaf9cc`
- ManagedEntity: `men_f4aa131f-8e2f-487f-8789-d383d0c09056`
- Case: `case_ce273b25-df95-4d17-a99b-5209a48b0d34`
- ResourceReservation: `rr_8a91ea16-8e60-4b6f-b176-fc9fb74a1938`
- Appointment: `apt_fdd03d05-3cc1-4323-a0ff-14394fd1a4cf`
- Service: `Car Wash`
- Offering: `Executive Clean`
- Appointment date: `2026-09-10`
- Slot: `07:00–07:30`

The WebChat and Temporal Workflow Inspector independently showed all 12 workflow-map steps as `COMPLETE` and the same business projection. Invalid human-date input was rejected with `INVALID_DATE`, after which a valid human date continued the same workflow to completion.

P1 WebChat browser path, persistence/idempotency lineage, final-candidate regression and stale-session recovery are **CERTIFIED**.

## Physical evidence — P2 Telegram

A real Telegram app -> official Bot API -> Engines runner -> canonical CTA -> Temporal -> PostgreSQL appointment completed successfully.

- Provider event: `telegram:update:974290101`
- External conversation: `telegram:1589599355`
- Workflow: `register-appointment:golden-business:1b038e5bd85758f545010271b805c035`
- Appointment: `apt_1cf266e8-ff46-4b65-928e-8a34f36fde49`
- Case: `case_27087ad0-b859-4597-8544-95655a64d70c`
- ResourceReservation: `rr_cd6f787b-2240-434b-8604-994e721f3674`
- Reservation status: `BOOKED`
- CTA ingress: `cta_21e2c091238691866fc7fea4d0dd30d6c5d4500940ee7412a8ae557d18108f56`
- CTA status: `COMPLETED`

Exact normalized replay returned the same workflow, Case and Appointment with `duplicate_count=1` and exactly one Appointment, Case and Reservation.

Subsequent physical regressions proved name + email + phone capture before resolution, no user-facing `Continuar`, completed-to-new-appointment lifecycle in one Telegram chat, and distinct workflows/Appointment ids for sequential appointments.

P2 physical provider delivery, persistence, provenance and replay/idempotency are **CERTIFIED**.

## Physical evidence — P3 WhatsApp / Kapso

A real WhatsApp -> Kapso signed webhook -> Engines live runner -> canonical CTA -> Temporal -> PostgreSQL appointment completed successfully.

- Provider event: `whatsapp:message:wamid.HBgLNTE5MzMwNzUyMDAVAgASGBYzRUIwNDgwOTY2MjY0N0RCRkU4OEYwAA==`
- External conversation: `whatsapp:d9f75920-b18f-43b8-bec8-aa65c494ba31`
- Workflow: `register-appointment:golden-business:604069189f45f508ace069c8f994b3c3`
- Appointment: `apt_b1d89420-9aab-4a2e-bf44-d0e8319ac8fb`
- Case: `case_be7f10dd-f727-424f-b96a-b230d8540905`
- Reservation status: `BOOKED`
- CTA ingress: `cta_29c4cd0d68a03e59b839be7ee65b212521529da31645622cf02f8fc0443142ff`

After WA-LC01 was fixed, the same physical workflow reconciled to:

```text
CTA ingress = COMPLETED
binding     = COMPLETED
```

Exact signed Kapso webhook redelivery produced:

```text
EVENT_RECEIVED
duplicate_count = 1
appointments_for_workflow = 1
cases_for_workflow = 1
reservations_for_workflow = 1
reservation_status = BOOKED
```

P3 physical provider delivery, persistence/provenance and replay/idempotency are **CERTIFIED**.

## Certified boundaries

Certified for this PoC candidate lineage:

- provider-neutral Register Appointment CTA;
- non-destructive provider compatibility boundary;
- CTA ingress persistence and stable provider-event replay identity;
- Temporal RegisterNewAppointment orchestration;
- Customer / ManagedEntity / Case / Appointment graph;
- ResourceReservation success and failure compensation lifecycle;
- operational timeline persistence;
- workflow-scoped terminal CTA reconciliation;
- sequential appointments in one provider conversation;
- terminal channel rebinding semantics;
- Telegram stale-Temporal-binding recovery;
- WebChat physical path + idempotency + final-candidate regression + stale-session recovery;
- Telegram physical provider path + idempotency;
- WhatsApp/Kapso physical provider path + signed webhook replay/idempotency;
- deterministic Telegram and WhatsApp transport regressions;
- API, Messenger, Facebook Comment and TikTok adapter/capability contracts covered by the CTA suite.

## Pre-merge gate status

Selected physical gates are closed:

```text
P1 WebChat physical             PASS
P1 replay/idempotency           PASS
WEBCHAT-ST01 physical recovery  PASS
P2 Telegram physical            PASS
P2 replay/idempotency           PASS
P3 WhatsApp/Kapso physical      PASS
P3 replay/idempotency           PASS
Final candidate CI              PASS
Final WebChat regression        PASS
```

Messenger, Facebook Comments and TikTok physical provider delivery do not block this first PoC unless the claim is expanded to physical certification for those providers.

## Truth boundary

No AI Agent, MCP, full Services Engine, full Scheduler Engine, production readiness, universal physical-provider certification, or release readiness is claimed.

## Merge state

The technical and selected physical pre-merge gates are closed. PR #24 may be marked **Ready for Review**, but it remains **unmerged**. Merge requires explicit user authorization.
