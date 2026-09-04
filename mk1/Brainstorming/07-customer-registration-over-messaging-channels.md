# Brainstorming 07 — Customer registration over WhatsApp and Telegram

Date: 2026-09-04
Status: DESIGN DISCUSSION FROZEN FOR NEXT BUILD SLICE

## Scope

For the next messaging-channel slice, WhatsApp and Telegram exist only as client transports into the existing Engines CTA boundary.

The only business Workflow exercised in this slice is:

```text
RegisterNewCustomer
```

Appointment, advisor handoff, campaigns, Scheduler, and other business Workflows remain outside the first transport implementation, even when the UI shows future buttons for them.

## User journey

A conversation may begin because:

1. the customer writes to the business; or
2. the business sends an allowed outbound message/promotion and the customer replies or presses an interactive action.

Both paths converge on the same ingress boundary:

```text
Customer
  ↓
WhatsApp / Telegram
  ↓
transport adapter
  ↓
canonical CTA command
  ↓
Temporal
  ↓
RegisterNewCustomer
```

The transport never decides Customer completeness itself.

## First-contact consent gate

For a first registration interaction, the transport can render a deterministic consent prompt before starting the Customer Workflow:

```text
"¿Me permites guardar tus datos para registrarte en nuestro sistema?"

[ Sí, registrarme ]
[ Ahora no ]
```

The affirmative action is the explicit trigger that starts `RegisterNewCustomer`.

This gate is not permission for the transport to invent or silently enrich Customer data. Provider metadata can only be forwarded as Customer material after the user has explicitly chosen to register and only where the provider identity is suitable for that field.

## Engine-driven collection

After the Workflow starts, Temporal is authoritative for what is still missing.

The channel should effectively execute:

```text
query RegisterNewCustomer state
  ↓
read missingFields / nextAction
  ↓
render one deterministic question
  ↓
receive answer
  ↓
ProvideCustomerData
  ↓
query state again
```

The question order is a renderer/conversation policy over the Workflow's missing-field truth; the transport must not redefine the required Customer policy.

A target UX can be:

```text
Temporal says: name missing
→ "¿Cuál es tu nombre?"

Temporal says: email missing
→ "¿Cuál es tu correo?"

Temporal says: phone missing
→ request/ask for phone
```

Once the Workflow reports complete, the channel renders explicit finalization rather than silently creating a Customer.

## Important current Engine gap

The currently certified golden registration policy requires:

```text
customer.name
customer.contact.phoneOrEmail
```

It does NOT currently require both phone AND email separately.

The desired messaging UX described for this slice is stricter:

```text
name + phone + email
```

That requirement must not be hardcoded in WhatsApp or Telegram. If we choose it as the canonical business minimum, the Customer registration policy must evolve in a separate Engine-domain gate to support independent requirements such as:

```text
customer.contact.phone
customer.contact.email
```

while preserving `phoneOrEmail` for businesses that only require one contact method.

Until that Engine policy evolution is certified, messaging adapters may collect extra optional material, but they may not claim that phone+email is the canonical minimum.

## WhatsApp prefill

WhatsApp provides a business conversation sender identity through the official provider path.

The adapter may derive a phone candidate from the official sender identity only when the selected provider contract marks that value as suitable to seed the Customer phone field.

Preferred UX after consent:

```text
known provider phone
→ seed canonical Customer phone patch
→ do not ask the user to type the same phone again
```

Name/profile material should be treated as a hint unless the Customer policy explicitly allows accepting it without confirmation.

## Telegram prefill

Telegram Bot API chat/user identity is not a phone number.

Therefore Telegram cannot follow the WhatsApp shortcut automatically.

Initial Telegram UX:

```text
name       → ask/confirm
email      → ask
phone      → request contact sharing or allow typed phone
```

A Telegram `request_contact` interaction can be rendered in a private chat, but the user must explicitly share the contact. Telegram user/chat IDs remain transport identities, not Customer phone fields.

## Completion menu

After Customer creation succeeds, both transports may render a neutral post-registration menu:

```text
Registro completado ✅

[ Agendar una cita ]
[ Hablar con un asesor ]
```

For this first slice those buttons are presentation/navigation placeholders only. They do not open Appointment or Advisor Workflows until their corresponding channel slices are explicitly built and certified.

## Promotions and recurring outbound messages

The example promotional card with interactive actions is a valid future entry surface, but campaign scheduling is not part of `RegisterNewCustomer`.

Later architecture:

```text
Campaign / notification trigger
  ↓
Integration / outbound messaging boundary
  ↓
WhatsApp or Telegram transport
  ↓
customer presses CTA
  ↓
canonical inbound CTA event
  ↓
Temporal Workflow
```

The outbound campaign system may decide when to send an allowed message, but once the customer interacts, the resulting business action re-enters the same canonical CTA path.

## First slice success condition

For each channel, prove only:

```text
first-contact consent
→ same RegisterNewCustomer Workflow
→ provider-known fields safely prefilled where valid
→ missing fields collected from Workflow truth
→ explicit finalize
→ Customer CREATED / existing duplicate behavior preserved
→ durable replay/restart semantics retained
```

No Agent, MCP, semantic classifier, Appointment flow, advisor flow, or marketing scheduler is required for this slice.
