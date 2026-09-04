# Quarry 05 — Interactive channel E2E proof boundary

Date: 2026-09-04

## Question

What is the smallest local proof that demonstrates Telegram and WhatsApp are only CTA transports while Engines/Temporal remain the registration authority?

## Existing assets

- `CustomerRegistrationChannelExecutionCore` already owns durable channel event/binding execution for `RegisterNewCustomer`.
- `projectCustomerRegistration` already maps Temporal state to provider-independent render intent.
- `TelegramAdapter` already maps callback/text/contact material.
- `WhatsAppAdapter` already maps verified interactive/text material and prefills verified sender phone on consent.
- `MetaCloudApiTransport` can verify an HMAC fixture without a real Meta account.
- Docker Compose already provides PostgreSQL, MongoDB, Temporal, migrations and the Worker.

## Gap

There is no human-facing local process composing those pieces into one conversation against real Temporal and real persistence.

The existing `channel-core` HTTP server remains Appointment-oriented and is not required for this lab. The interactive proof should compose the customer channel core directly instead of changing an unrelated public HTTP boundary merely for a lab surface.

## Chosen seam

Add a one-off Docker Compose service:

```text
messaging-lab
```

It runs inside the Compose network so it can reach PostgreSQL and Temporal without exposing database ports to the Windows host.

The human invokes:

```text
docker compose run --rm messaging-lab
```

## Proof invariants

1. Consent NO exits before any canonical start operation.
2. Consent YES crosses the real provider adapter into `CustomerRegistrationChannelExecutionCore`.
3. Every follow-up question comes from live Temporal state projection.
4. WhatsApp phone is known from verified sender material and is not asked again.
5. Telegram does not infer a phone from `chat.id`/`from.id`.
6. Invalid canonical customer data does not kill the Workflow.
7. Terminal success prints the real Workflow ID and Customer ID.
8. Channel event/binding durability remains PostgreSQL-backed.

## Harness identity

Every simulator execution generates unique synthetic conversation/sender/event identities so repeated manual runs do not collide accidentally with prior lab runs.

No synthetic identity is presented as a real provider identity.

## Non-goal

This quarry does not choose Meta vs Kapso and does not implement network clients for Telegram or WhatsApp.
