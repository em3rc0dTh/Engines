# CTA Orchestration Register Appointment PoC — pre-merge certification receipt

Date: 2026-09-08
Repository: `em3rc0dTh/Engines`
Branch: `feature/cta-orchestration-register-appointment-poc`
Draft PR: `#24 — CTA orchestration: canonical Register Appointment PoC`

## Current candidate

Current branch HEAD:

- Branch HEAD: `adb6ccec66d269e1dc0ef8761445d4f7d4283d27`
- Code candidate certified by the fix-pack CI: `9785f363c08790bd3cfed1bfc56f680fe71b2377`
- Difference from code candidate to branch HEAD: evidence/documentation only
- PR state: Draft, open, mergeable, unmerged

Fresh CI on the code candidate:

- `CTA Orchestration Appointment PoC` — run `34273816610` — **PASS**
  - artifact `cta-orchestration-poc-34273816610`
  - artifact id `10074933246`
  - digest `sha256:80fb5a366c58475ba50e5af2c87347ea86534847cf5b1d6bc82b7e668652336e`
- `MK1 C2 Telegram Official Bot API Transport` — run `34273816578` — **PASS**
  - artifact `mk1-c2-telegram-official-34273816578`
  - artifact id `10074917580`
  - digest `sha256:31b8242f0d3f75495455da7d976089c72fb44382a14423013ce7f43b6002e954`
- `MK1 C4P Kapso Official WhatsApp Transport` — run `34273816586` — **PASS**

The receipt distinguishes deterministic/clean-stack certification from physical provider evidence. CI transport jobs do not by themselves prove live provider delivery.

## Certified clean-stack architecture

```text
provider / existing adapter boundary
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

The candidate passes TypeScript, CTA compatibility/routing, existing channel regressions, clean PostgreSQL + MongoDB + Temporal startup, orchestration persistence verification, and evidence capture.

## Lifecycle fix pack closed on current code candidate

Physical testing exposed four lifecycle/UX gaps. They are implemented and covered by CI on `9785f363c08790bd3cfed1bfc56f680fe71b2377`.

### TG-UX01 — appointment contact completeness

Appointment auto-resolution now evaluates `GOLDEN_REGISTRATION_POLICY_V2`, so a new appointment customer must have:

```text
name + phone + email
```

The internal `Resolve Customer` operation remains automatic. The customer does not receive a meaningless `Continuar` button for an internal workflow step.

### TG-LC01 — stale binding after Temporal dev-server reset

The Telegram live runner detects a Temporal workflow-not-found result instead of polling the stale binding until `TELEGRAM_APPOINTMENT_QUERY_TIMEOUT`.

The stale binding is reconciled to `FAILED` with workflow identity protection. A new `/appointment` event can then replace that terminal binding and start a fresh durable workflow in the same Telegram chat.

### Channel binding lifecycle

`channel_conversation_bindings` now acts as the current conversation pointer:

```text
ACTIVE -> COMPLETED | FAILED
terminal binding + new workflow -> ACTIVE rebinding
```

Active bindings still reject conflicting workflow material. Terminal bindings may be atomically rebound to a new workflow for a later appointment in the same provider conversation.

### CTA-LC01 — multiple appointments in the same provider conversation

CTA terminal reconciliation is now scoped by both correlation and authoritative `workflow_id`. It no longer updates the oldest `register_appointment` ingress merely because multiple appointments share one Telegram chat/correlation id.

The clean-stack certification now explicitly creates **two sequential appointments in one conversation**, verifies distinct workflow and Appointment identities, verifies both CTA ingress records remain independently `COMPLETED`, and verifies the conversation binding points to the second workflow with `COMPLETED` status.

Run `34273816610` produced:

```text
CTA_ORCHESTRATION_POC_PASS
sequentialConversation = true
first workflow / appointment  = distinct
second workflow / appointment = distinct
```

## Physical WebChat evidence — P1

A real browser WebChat run was completed on the pre-Telegram-wiring candidate and proved the actual browser path through the canonical appointment architecture.

Physical workflow:

- Workflow: `register-appointment:golden-business:ebbe4959f906ca0c382dcbffe715f035`
- Appointment: `apt_910686b8-3d63-432c-bd34-006630616308`
- Case: `case_4e014b41-5a75-446e-8bd2-9faf28e05b36`
- ResourceReservation: `rr_f60c5b49-637a-4e04-aa41-c83f0d2e064e`
- Reservation status: `BOOKED`
- CTA ingress: `cta_80e59dd777d951cce9a23340c4ad9f405fa0805c9ee20b0254e6e941665f1474`
- CTA status: `COMPLETED`
- Timeline: `APPOINTMENT_REGISTERED`

The exact WebChat start event was replayed. Result:

```text
replayed = true
duplicate_count = 1
appointments = 1
cases = 1
reservations = 1
```

Closing the browser tab before finalization did not terminate the Temporal workflow; the same conversation was recovered and finalized.

Known physical-test discovery `WEBCHAT-ST01` remains open: stale browser `localStorage` after a backend volume reset can retain a conversation id that no longer exists and leave Start Workflow disabled. Incognito/clearing the stale browser state recovers. This remains a pre-merge fix unless explicitly deferred.

Because the branch has changed since the original physical run, WebChat requires only a short final regression smoke on the eventual merge candidate.

## Physical Telegram evidence — P2

A real Telegram app -> official Bot API -> Engines runner -> canonical CTA -> Temporal -> PostgreSQL appointment was completed successfully.

Physical provider evidence:

- Provider event: `telegram:update:974290101`
- External user: `telegram:user:1589599355`
- External conversation: `telegram:1589599355`
- Workflow: `register-appointment:golden-business:1b038e5bd85758f545010271b805c035`
- Appointment: `apt_1cf266e8-ff46-4b65-928e-8a34f36fde49`
- Case: `case_27087ad0-b859-4597-8544-95655a64d70c`
- ResourceReservation: `rr_cd6f787b-2240-434b-8604-994e721f3674`
- Reservation status: `BOOKED`
- CTA ingress: `cta_21e2c091238691866fc7fea4d0dd30d6c5d4500940ee7412a8ae557d18108f56`
- CTA status: `COMPLETED`
- Channel operation: `RegisterNewAppointment`
- Timeline: `APPOINTMENT_REGISTERED`

The exact normalized provider start event was replayed against channel-core. Result:

```text
replayed = true
duplicate_count = 1
same workflowId
same caseId
same appointmentId
appointments_for_workflow = 1
cases_for_workflow = 1
reservations_for_workflow = 1
```

Therefore P2 physical provider delivery, persistence, provenance and replay/idempotency are certified for the tested candidate lineage.

A subsequent physical UX smoke proved removal of the manual `Continuar` customer-resolution button, and also exposed the V1 contact-completeness issue that is now fixed on the current code candidate with V2. The final candidate needs only a short Telegram regression smoke to confirm `name -> email -> phone -> service` and the lifecycle recovery changes; the full physical booking does not need to be repeated unless the smoke reveals a regression.

## Transport regression evidence

### Telegram

Code-candidate run `34273816578` passes:

```text
TypeScript
Bot API deterministic client tests
Telegram adapter tests
Telegram lifecycle recovery tests
clean Engines infrastructure
existing real-Temporal Telegram regression
```

This CI job is deterministic/runtime evidence and is separate from the physical Telegram evidence above.

### WhatsApp / Kapso

Code-candidate run `34273816586` passes the deterministic/runtime Kapso transport suite and existing real-Temporal regression.

This does **not** yet certify a new physical WhatsApp provider delivery. P3 remains open.

## Certified boundaries

Certified in the candidate lineage:

- canonical provider-neutral Register Appointment CTA;
- compatibility boundary preserving provider parsing/auth internals;
- CTA ingress persistence and stable provider-event replay identity;
- Temporal RegisterNewAppointment orchestration;
- Customer / ManagedEntity / Case / Appointment graph;
- ResourceReservation success and compensation lifecycle;
- operational timeline persistence;
- terminal CTA failure reconciliation;
- workflow-scoped CTA completion/failure reconciliation;
- sequential appointments in the same provider conversation;
- terminal channel rebinding semantics;
- Telegram stale-Temporal-binding recovery logic;
- WebChat physical provider/browser path and replay;
- Telegram physical provider path and replay;
- deterministic Telegram and WhatsApp transport regressions;
- API, Messenger, Facebook Comment and TikTok adapter/capability contracts covered by the CTA suite.

## Explicitly open before merge

- Short Telegram regression smoke on the current/final candidate (`name -> email -> phone -> service`) and stale-binding recovery confirmation.
- P3 physical WhatsApp/Kapso provider delivery, persistence/provenance and replay if WhatsApp is selected as a merge gate.
- Final WebChat regression smoke on the eventual merge candidate.
- `WEBCHAT-ST01` stale-browser-state recovery fix unless explicitly deferred.
- Final evidence review.

Messenger, Facebook Comments and TikTok physical provider events are not required to block this first PoC unless the merge claim is expanded to physical certification for those providers.

## Truth boundary

No AI Agent, MCP, full Services Engine, full Scheduler Engine, production readiness, universal physical-provider certification, or release readiness is claimed.

## Merge state

PR #24 remains Draft and unmerged. Merge requires explicit authorization after the selected physical gates, final smoke checks, known pre-merge defect decision and evidence review are complete.
