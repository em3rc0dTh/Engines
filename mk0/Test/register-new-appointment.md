# Test Contract — RegisterNewAppointment

## Scope

This document captures the second MK0 specimen test contract as closed by the certified implementation.

It proves orchestration reuse and atomic booking behavior. It does **not** certify a complete Scheduler Engine.

## A0 — Customer resolution

### A0-001 Existing Customer

Given an existing active Customer ID or uniquely matching contact/document identity:

Expected:

```text
customer.status = EXISTING
customerId = existing Customer
new Customer delta = 0
```

### A0-002 New Customer through Child Workflow

Given a complete new Customer draft with no existing match:

Expected:

```text
RegisterNewAppointment
→ Child Workflow RegisterNewCustomer
→ terminal Customer result
→ returned customerId
→ parent continues
```

The Appointment Workflow must not insert Customer rows directly.

### A0-003 Incomplete Customer

Given a new Customer draft missing policy-required contact material:

Expected:

```text
phase = WAITING_FOR_CUSTOMER
issue = CUSTOMER_INCOMPLETE
Service selection unavailable
Appointment delta = 0
```

## A1 — Service catalog

After Customer resolution:

Expected:

- active Services are loaded through a Temporal Activity;
- current fixture includes `svc_car_wash / Car Wash`;
- Service selection is impossible before `WAITING_FOR_SERVICE`;
- selecting an unknown/non-active Service is rejected.

## A2 — Product catalog

After Service selection:

Expected fixture Products:

```text
prd_car_wash_basic       Basic Clean       30 min
prd_car_wash_executive   Executive Clean   30 min
prd_car_wash_salon       Salon Clean       30 min
```

A Product must belong to the selected Service and be active.

## A3 — Date normalization

CTA accepts supported human date forms and sends canonical `YYYY-MM-DD` into the Workflow.

Certified examples include:

```text
Friday == viernes
YYYY-MM-DD
DD/MM/YYYY
DD-MM-YYYY
English/Spanish month names
today / hoy
tomorrow / mañana
```

Past dates such as `ayer / yesterday` are rejected and must not advance durable appointment-date state.

Malformed calendar dates are rejected.

## A4 — Availability

After Product + valid date:

Expected:

- availability is loaded through an Activity from PostgreSQL fixture truth;
- occupied bookings are removed;
- the fixture produces 30-minute slots between 06:00 and 07:30 when unoccupied;
- an unavailable/nonexistent slot cannot become selected.

Important:

```text
shown available slot != reserved capacity
```

## A5 — Explicit finalization

After Customer + Service + Product + Date + Slot:

Expected:

```text
workflowStatus = RUNNING
phase = READY_TO_FINALIZE
result = absent
Appointment row = absent
```

Only explicit `FinalizeAppointment` may authorize persistence.

## A6 — Atomic booking

At finalization:

Expected:

- Customer still exists and is active;
- Product/Service relationship is revalidated;
- selected slot is revalidated inside the persistence transaction;
- exactly one Appointment is inserted;
- appointment command moves to `BOOKED`;
- result contains canonical customer/service/product/date/slot identity.

## A7 — Same-slot race

Start two independent Workflows targeting the same resource/date/start slot.

Both may observe the slot as available and reach `READY_TO_FINALIZE`.

Expected after both finalize:

```text
winner:
  COMPLETED / CREATED
  Appointment persisted

loser:
  RUNNING / WAITING_FOR_SLOT
  issue = SLOT_NOT_AVAILABLE
  result = absent
  refreshed availability excludes lost slot
```

The business authority must prevent double booking even if the pre-finalize availability observations were identical.

## A8 — Appointment idempotency

Exact replay with the same business-scoped idempotency identity and initial material:

Expected:

```text
same Workflow ID
same Run ID
no second Appointment
```

Materially conflicting reuse must not create a second business effect.

## A9 — Mongo semantic audit

Successful booking requires the applicable appointment audit sequence to be persisted and verified before the Workflow reports terminal completion.

Audit collection:

```text
appointment_audit
```

Temporal Event History and Mongo semantic audit remain distinct evidence planes.

## A10 — Manual interaction behavior

The local Appointment Lab Console should make state-machine constraints visible:

- calling `services` before Customer resolution does not advance the Workflow;
- attempting `service 1` in `WAITING_FOR_CUSTOMER` is rejected;
- invalid/past date remains `WAITING_FOR_DATE`;
- invalid slot remains `WAITING_FOR_SLOT`;
- valid slot reaches `READY_TO_FINALIZE`;
- `finish` creates the Appointment.

## Certified automated gate

Source:

```text
70ab427f34bf353a7239f2f87bbe3b4889ec1efd
```

Run:

```text
33014515270
```

Markers:

```text
APPOINTMENT_NEW_CUSTOMER_CHILD_PASS
APPOINTMENT_CATALOG_PASS
APPOINTMENT_PAST_DATE_REJECTED
APPOINTMENT_DATE_AND_SLOTS_PASS
APPOINTMENT_BOOKING_PASS
APPOINTMENT_IDEMPOTENCY_REPLAY_PASS
APPOINTMENT_SLOT_CONFLICT_PASS
MK0_REGISTER_NEW_APPOINTMENT_PASS
```

See [`../Build/evidence/mk0-register-new-appointment-certification-2026-08-26.md`](../Build/evidence/mk0-register-new-appointment-certification-2026-08-26.md).

## Scope boundary

The fixture's single `default` resource and 30-minute slots are not the final TimeSlots/Scheduler contract. Real Scheduler work must separately define ResourceReservation, capacity, holds/expiry, schedule overrides and multi-resource allocation.
