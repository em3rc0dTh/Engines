# CTA → Orchestration → Persistence compatibility boundary

Date: 2026-09-08  
Branch: `feature/cta-orchestration-register-appointment-poc`

## Decision

Provider authentication and payload parsing remain in provider adapters. A new compatibility layer converts their trusted output into `CanonicalCTAEvent`; the deterministic CTA Router maps `register_appointment` to the existing durable Temporal workflow.

```text
provider webhook
  -> provider authentication/parser
  -> existing or new ChannelAdapter
  -> compatibility mapper
  -> CanonicalCTAEvent
  -> CTAIngressRecord
  -> deterministic CTA Router
  -> RegisterNewAppointment Temporal workflow
  -> PostgreSQL operational graph + MongoDB audit
```

The compatibility layer does not authenticate providers. The provider adapter does not create Customers, Cases, Appointments or ResourceReservations.

## Catalog selection rule

The provider-neutral contract exposes one choice: `catalogOfferingId`. It does not require `Choose Service → Choose Product`.

The inherited Appointment workflow still carries a Service projection from S7. `AppointmentChannelExecutionCore` therefore resolves the selected CatalogOffering and supplies its parent Service internally as a compatibility operation. This is not a public workflow requirement and can be removed when the Appointment workflow consumes CatalogOffering directly.

This follows the supplied v3/v4 lineage: CatalogOffering is the commercial-operational source of truth, while ResourceReservation is the capacity authority.

## Persistence authority

- PostgreSQL: CTA ingress lifecycle and the operational graph.
- MongoDB: appointment audit/context events already emitted by Temporal.
- No provider-specific Case, Appointment or ResourceReservation schema exists.

The graph created atomically after capacity is held is:

```text
Customer -> ManagedEntity -> Case -> Appointment -> ResourceReservation(BOOKED)
                                      |
                                      -> TimelineEvent
```

If graph construction fails after the capacity hold commits, compensation changes the reservation from `HELD` to `RELEASED` with a reason.

## Provider truth boundary

- WebChat, Telegram, WhatsApp/Kapso and API have deterministic compatibility fixtures.
- Messenger and Facebook Comments include Meta HMAC verification and payload decoders.
- Facebook comments only create a public trigger record. Personal data collection requires a private continuation.
- TikTok includes the official timestamped HMAC verifier and a canonical future adapter. The currently documented general TikTok webhook events do not establish comment/DM CTA delivery; no physical TikTok claim is made.

## Security properties

- Provider signatures are checked on raw bytes before JSON normalization.
- Idempotency derives from business + provider + provider event identity.
- A repeated event increments `duplicate_count` without starting a second Workflow.
- Reuse of the same event identity with different canonical material fails closed.
- Unsupported actions never create an operational Case.
