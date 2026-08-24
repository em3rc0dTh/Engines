# Quarry 03 — CTA / Omnichannel Entry Boundary

## Status

**PROJECT DECISION LOCKED / CTA ADAPTER BOUNDARY IDENTIFIED**

## Project decision

mk0 does not select an application framework.

Current CTA senders:

- Postman;
- CLI.

Future senders explicitly expected by the architecture:

- Form / Web UI;
- MCP;
- WhatsApp;
- Telegram;
- Web Chat;
- Mobile App;
- Voice / IVR;
- API / Webhook;
- Email;
- future channels.

Classification: `PROJECT_DECISION`.

## Core boundary rule

Every channel converges through a **CTA Adapter contract** before entering the Temporal Orchestration Engine.

```text
channel-specific input
→ CTA Adapter
→ structural validation
→ normalization
→ canonical command
→ Temporal Workflow start
→ durable workflowId
→ later query/result
```

The CTA Adapter is not a framework choice. It is an architectural boundary.

## Why the adapter exists

Without the adapter, every channel would need to understand:

- Temporal transport details;
- Temporal payload encoding;
- Workflow naming/routing details;
- idempotency conventions;
- correlation conventions;
- attachment ingress conventions.

That would couple WhatsApp, Telegram, MCP, forms and Postman directly to the orchestration implementation.

The platform diagram intentionally places a CTA Adapter between channels and the Orchestration Engine. mk0 preserves that boundary.

## Postman / CLI distinction

### CLI

A CLI may use the official Temporal client/SDK directly while implementing the CTA Adapter semantics locally.

Conceptually:

```text
CLI input
→ validate/normalize
→ Temporal client
→ RegisterNewCustomer
```

### Postman

Postman should send a business-friendly command through a transport-compatible CTA Adapter.

Preferred shape:

```text
Postman
→ thin framework-free transport adapter
→ canonical command
→ Temporal client
→ RegisterNewCustomer
```

Direct exposure of Temporal-native protocol/payload details to Postman is not the canonical architecture because it makes the CTA depend on Temporal internals rather than the stable CTA Adapter contract.

Classification: `DESIGN_DECISION`.

## Structural validation before Temporal

Reject before Workflow start when the input cannot form a legal command, including:

- malformed envelope;
- missing `businessSlug`;
- missing Customer type/name;
- missing idempotency identity;
- missing required contact locator;
- malformed attachment reference;
- forbidden scheduling/service fields.

A rejected command creates no Customer, no committed attachment and no business Workflow side effect.

Classification: `DESIGN_REQUIREMENT`.

## Durable validation after acceptance

Validation requiring persisted state or business policy executes durably through Temporal Workflow/Activities after acceptance.

Examples:

- idempotency receipt comparison;
- existing registration lookup;
- attachment ingress state;
- business policy requiring persistence.

The Build must keep the structural/business validation split explicit.

## Continuity rule

The originating CTA connection/session is disposable.

Required proof:

```text
CTA starts Workflow
→ receives workflowId
→ CTA disconnects/stops
→ Temporal keeps executing
→ Worker may restart
→ Temporal resumes
→ CTA reconnects later
→ queries workflowId
→ sees same durable outcome
```

Continuity is therefore owned by Temporal, not by an open client socket.

Classification: `DESIGN_REQUIREMENT`.

## Forbidden CTA behavior

```text
CTA/channel → PostgreSQL direct write
CTA/channel → MongoDB direct write
CTA Adapter → final attachment commit bypassing Temporal
CTA Adapter → Customer registration state machine
CTA Adapter → business retry loops
CTA Adapter → hidden scheduling/service side effects
```

## Future channel rule

A future CTA implementation may use any appropriate channel SDK/framework, but it must preserve:

```text
channel
→ CTA Adapter contract
→ canonical command
→ Temporal
```

A channel-specific implementation must not:

- become orchestration authority;
- own Customer persistence sequencing;
- bypass Temporal;
- change canonical command semantics;
- create a second business path.

## Build-time unknowns

Still intentionally open:

- exact language/SDK used by the first CTA Adapter;
- exact Postman transport shape;
- exact CLI UX;
- authentication/authorization for external channels;
- channel-specific error/status mapping;
- attachment ingress transport;
- protocol/version negotiation.

These are Build choices, not architecture choices.
