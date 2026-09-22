# Channel × ManagedEntity → RegisterNewAppointment

Date: 2026-09-22
Scope: MK1 pre-Agent provider integration

## Purpose

This build note documents the provider-facing ManagedEntity slice used by native Telegram and WhatsApp/Kapso Appointment journeys.

The channel layer does not decide what a ManagedEntity means and does not infer a vehicle, asset or other operational subject. Temporal/core owns that policy. Provider adapters only render durable Workflow state, collect explicit provider input, and translate that input into canonical Appointment actions.

## Canonical flow

~~~text
START_APPOINTMENT
  ↓
Customer resolution
  ↓
WAITING_FOR_MANAGED_ENTITY
  ├─ SELECT_MANAGED_ENTITY
  └─ CREATE_MANAGED_ENTITY
  ↓
SELECT_SERVICE
  ↓
SELECT_PRODUCT / offering
  ↓
SET_DATE
  ↓
SELECT_SLOT
  ↓
FINALIZE_APPOINTMENT
  ↓
Appointment + OperationalCase + SchedulerReservation
~~~

## ManagedEntity selection

When Temporal projects WAITING_FOR_MANAGED_ENTITY with nextAction SELECT_MANAGED_ENTITY, the provider renders only the durable candidates supplied by the Workflow.

The selected provider control maps to:

~~~text
SELECT_MANAGED_ENTITY
{
  managedEntityId
}
~~~

The adapter does not guess or synthesize the ManagedEntity id.

### Telegram callback identity

The initial human-readable prefix:

~~~text
appointment_managed_entity:<managedEntityId>
~~~

was physically rejected for UUID-shaped ids with Telegram HTTP 400 because callback_data exceeded the provider budget.

The hardened format is:

~~~text
ame:<managedEntityId>
~~~

The adapter remains backward-compatible with the previous prefix while new rendering uses the compact format. Regression coverage asserts a UUID-shaped callback stays within 64 UTF-8 bytes.

## ManagedEntity creation

When Temporal projects WAITING_FOR_MANAGED_ENTITY with nextAction CREATE_MANAGED_ENTITY, the provider asks for:

~~~text
nombre | referencia estable
~~~

Example:

~~~text
Renault Logan 2018 | ABC-123
~~~

The adapter maps explicit input to:

~~~text
CREATE_MANAGED_ENTITY
{
  displayName,
  externalRef
}
~~~

Temporal applies the business ManagedEntity policy. The channel does not own type/policy selection. Malformed creation input fails closed.

## Scheduler boundary

The current Appointment runtime uses the G2-S7+ Scheduler authority.

~~~text
appointments.resource_reservation_id = NULL

appointments.scheduler_reservation_id
→ scheduler_reservations.reservation_id
~~~

The operational subject is carried by Appointment.managed_entity_id and OperationalCase.managed_entity_id. Capacity is carried by SchedulerReservation and SchedulerReservationAssignment.

Certified invariant:

~~~text
Appointment.managed_entity_id
=
OperationalCase.managed_entity_id

Appointment.scheduler_reservation_id
→ SchedulerReservation(status = RESERVED)

SchedulerReservation
→ one certified resource assignment

legacy resource_reservation_id
= NULL
~~~

A SchedulerReservation does not own managed_entity_id.

## Date availability presentation

The Workflow already distinguishes a valid date with no capacity:

~~~text
valid date
→ listAppointmentSlots
→ 0 slots
→ issue NO_AVAILABILITY
→ appointmentDate cleared
→ WAITING_FOR_DATE
~~~

Current Telegram and WhatsApp rendering preserves that truth:

~~~text
NO_AVAILABILITY
→ No hay horarios disponibles para esa fecha. Elige otra fecha.

PAST_DATE
→ Esa fecha ya pasó. Elige una fecha futura.
~~~

## Ownership boundary

Provider adapters own transport, provider controls, durable-state presentation, and translation of explicit input to canonical actions.

They do not own Customer truth, ManagedEntity policy, Services eligibility, Scheduler capacity, Appointment persistence, Temporal ordering, Agent reasoning, or MCP.

## Evidence

Physical provider receipt:

~~~text
mk1/Build/evidence/channel-managed-entity-provider-physical-seal-2026-09-22.md
~~~

Integrated pre-Agent receipt:

~~~text
mk1/Build/evidence/platform-pre-agent-final-seal-2026-09-22.md
~~~
