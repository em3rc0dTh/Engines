# Design 12 — RegisterNewCustomer messaging-channel contract

Date: 2026-09-04
Status: DESIGN FROZEN ENOUGH FOR BUILD

## Architecture invariant

WhatsApp and Telegram are transport/CTA implementations only.

```text
WhatsApp ─┐
          ├─ transport → CTA adapter → canonical command → Engines
Telegram ─┘
                                               ↓
                                            Temporal
                                               ↓
                                      RegisterNewCustomer
```

Neither transport owns Customer registration policy, completeness, duplicate classification, persistence, or Workflow phases.

## Required Channel Core extension

The currently certified C1B channel vocabulary is Appointment-oriented. This Customer slice requires a transport-independent extension of the canonical channel action vocabulary.

Candidate actions:

```text
START_CUSTOMER_REGISTRATION
PROVIDE_CUSTOMER_DATA
FINALIZE_CUSTOMER_REGISTRATION
RESOLVE_CUSTOMER_DUPLICATE   # only when existing Workflow state requires it
```

These actions belong to ChannelExecutionCore, not to Telegram or WhatsApp.

Provider adapters map provider events into these same canonical actions.

## Conversation binding

One provider conversation is durably bound to one active Workflow operation at a time.

For this slice:

```text
operation = RegisterNewCustomer
```

The binding remains in PostgreSQL and survives provider-process restart.

A channel must not create another Customer Workflow merely because the transport process restarts or the provider redelivers an event.

## Start semantics

A first-contact registration start is explicit.

Example render intent:

```text
PROMPT:
"¿Me permites guardar tus datos para registrarte en nuestro sistema?"

ACTIONS:
ACCEPT_REGISTRATION
DECLINE_REGISTRATION
```

Only `ACCEPT_REGISTRATION` becomes `START_CUSTOMER_REGISTRATION`.

Decline terminates the registration attempt without creating a Customer Workflow.

## Provider-derived Customer material

Provider identity and Customer data are separate concepts.

A provider adapter may produce a safe canonical prefill patch only after registration is accepted.

### WhatsApp

```text
provider sender identity
  ↓
WhatsApp transport normalization
  ↓
phone candidate, if provider contract says it is suitable
  ↓
canonical CustomerDraft.contact.phones[]
```

The phone candidate must still pass the existing canonical Customer phone normalization/validation.

### Telegram

```text
chat.id / user.id
≠ phone
```

Telegram IDs remain `externalConversationId` / `externalSenderId` only.

A phone can enter Customer data through:

```text
explicit contact share
or
manually typed phone
```

Profile first/last name may be shown as a proposed value, but must not silently become canonical Customer name unless the registration policy explicitly allows that behavior.

## Workflow-driven prompting

After every accepted Customer patch, the channel queries the same Temporal Workflow state.

Current `RegisterNewCustomer` already exposes:

```text
knownFields
missingFields
nextAction
phase
workflowStatus
possibleDuplicate
customerId
result
```

Therefore the transport renderer does not need its own registration state machine.

Reference execution pattern:

```text
START_CUSTOMER_REGISTRATION
  ↓
GetRegistrationState
  ↓
render prompt for next missing field
  ↓
PROVIDE_CUSTOMER_DATA
  ↓
GetRegistrationState
  ↓
repeat
  ↓
FINALIZE_CUSTOMER_REGISTRATION
```

## Prompt ordering

If more than one field is missing, the conversation layer may define a deterministic presentation order, for example:

```text
name
email
phone
other policy-required fields
```

But a field may only be requested because the canonical Workflow/policy says it is missing or because the user explicitly opts to provide optional data.

The renderer must skip any field already safely known.

## Desired target policy vs current certified policy

Current certified golden policy:

```text
required:
- customer.name
- customer.contact.phoneOrEmail
```

Desired messaging minimum described for the future business experience:

```text
required:
- customer.name
- customer.contact.phone
- customer.contact.email
```

Those are not equivalent.

The channel build is forbidden from emulating the stricter policy in provider code.

If strict name+phone+email becomes the Engine requirement, first extend `RegistrationPolicy` in a separate Customer Engine branch, certify it, and then let both channels consume the resulting `missingFields` unchanged.

## Duplicate handling

All existing duplicate semantics remain authoritative.

Provider transport code must not decide whether a Customer already exists.

If the Workflow enters duplicate-decision state:

```text
Temporal
→ possibleDuplicate
→ nextAction = RESOLVE_DUPLICATE
```

then the renderer may display a provider-appropriate deterministic choice and map the selected response back to the canonical duplicate-resolution action.

## Completion

Customer persistence is only successful when Temporal reports terminal completion.

On completion:

```text
workflowStatus = COMPLETED
customerId present
result present
```

The renderer may then show:

```text
"Registro completado ✅"

[ Agendar una cita ]
[ Hablar con un asesor ]
```

Those post-registration buttons are not part of the first build's business execution.

## Outbound promotions

Promotional messages, recurring campaigns, and proactive notifications are an outbound concern and do not change this contract.

A promotion may contain a provider-specific interactive button. Once pressed, that reply becomes an inbound transport event and enters the same canonical CTA boundary.

## Required first-build proof

For both WhatsApp and Telegram deterministic harnesses:

```text
1. first contact received
2. explicit registration consent
3. RegisterNewCustomer started
4. provider-derived safe data is prefilled correctly
5. missing Workflow fields are requested
6. invalid material is rejected without Workflow corruption
7. exact duplicate event is replay-safe
8. provider process restart recovers same Workflow binding
9. explicit finalization completes Customer registration
10. no provider-specific Customer persistence/business policy exists
```

## Non-claims

This design does not certify:

- real Telegram transport;
- real WhatsApp transport;
- Meta vs Kapso provider selection;
- outbound campaign scheduling;
- advisor handoff;
- Appointment over Telegram/WhatsApp;
- strict name+phone+email registration policy;
- Agent/MCP/LLM routing.
