# G3/G5 — Integration Engine Boundary

## Status

**BOUNDARY DESIGN ONLY — IMPLEMENTATION DEFERRED**

Step 5 exists to isolate third-party systems and delivery mechanics from core business Engines.

## 1. Responsibility

> **Translate explicit internal integration commands/events into provider-specific requests, and normalize provider responses/events back into canonical integration outcomes.**

Candidate domains:

```text
Payments
ERP / POS / Accounting
Email / SMS / notifications
Maps / geocoding / location
external webhooks
third-party APIs
file/object exchange
```

## 2. Not business authority

Integration Engine must not become canonical truth for:

```text
Customer
Services
Scheduler
Appointment
Inventory/business domain state
payment approval policy
workflow state
```

Provider responses may cause a Temporal Workflow to decide what happens next, but adapters do not mutate core business tables directly.

## 3. Composition

```text
Temporal Workflow
   ↓ explicit Activity/Port
Integration Port
   ↓
Provider Adapter Registry
   ↓
Provider SDK / HTTP API
```

Inbound provider event:

```text
Provider webhook/event
   ↓
Integration ingress adapter
   ↓
durable event identity + authenticity verification
   ↓
canonical integration event
   ↓
Temporal Signal/Update/Workflow start as explicitly designed
```

## 4. Provider-neutral contracts

Candidate outbound command:

```ts
type IntegrationCommand = Readonly<{
  schemaVersion: 1;
  businessSlug: string;
  integrationKind: string;
  operation: string;
  operationId: string;
  payload: Readonly<Record<string, unknown>>;
  correlation?: Readonly<Record<string, string>>;
}>;
```

Provider credentials are resolved from server-side configuration/secret references, never supplied by channel/browser payloads.

## 5. Durable delivery semantics

For operations that require reliable delivery, Step 5 should support:

```text
outbox/inbox identity
idempotency
retry policy
backoff
provider timeout
rate limit handling
circuit state
terminal provider reference
normalized provider error
```

Business workflow retries and provider-transport retries must be distinguishable.

## 6. External identifier mapping

Use an explicit mapping boundary where necessary:

```text
internal entity/reference
↔ provider name/account
↔ external object ID
```

Provider IDs must not replace internal stable identities.

## 7. Payments boundary

Payment integrations should eventually expose transport/provider operations such as create intent/preference, fetch status, refund request, etc. Core payment state/policy must be modeled separately rather than inferred from browser redirects.

Webhook authenticity and server-side status verification are mandatory for payment certification.

## 8. Notifications boundary

Notifications are delivery requests, not Workflow truth.

```text
Workflow says: SendAppointmentReminder
Integration/Notification adapter says: delivered / rejected / retrying
```

Email/SMS/Telegram outbound notifications may share delivery infrastructure, but interactive Telegram conversation ingress remains CTA/Channel Adapter responsibility.

## 9. Telegram distinction

```text
Telegram interactive user conversation → Step 1 CTA
Telegram outbound notification delivery → may use Step 5 adapter later
```

This prevents a third-party API classification from collapsing two different platform responsibilities.

## 10. Webhooks

Inbound webhook handlers must implement provider-specific authenticity verification before canonicalization.

Canonicalized events require durable identity so provider retries do not create duplicate business effects.

The C1B durable event pattern is conceptually reusable but channel and integration ledgers should remain semantically distinct.

## 11. Persistence direction

Candidate PostgreSQL operational tables:

```text
integration_connections
integration_commands
integration_inbound_events
integration_external_refs
integration_delivery_attempts
```

Secret material should be referenced, not stored as plain operational rows.

Mongo may retain redacted semantic/audit context if useful.

## 12. What to defer

Do not build a universal integration platform before concrete provider requirements exist.

Initial Step-5 implementation should be driven by a real integration gate, likely payment or notification, while conforming to this boundary.

## 13. Non-claims

This design does not certify Mercado Pago, email/SMS, ERP, accounting, maps, webhook security, production secret storage or general Integration Engine completeness.
