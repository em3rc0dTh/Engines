# MK0 second specimen — RegisterNewAppointment

Status: DESIGN FROZEN FOR FIRST LAB IMPLEMENTATION

This document defines the second Engines specimen after `RegisterNewCustomer`.

The goal is not to build a complete scheduler product. The goal is to prove that the certified orchestration spine can be reused for a second operation with a different authority shape: catalog reads, customer reuse/creation, date interpretation, availability reads, conflict-safe appointment persistence and a multi-round Temporal conversation.

## Canonical operation

`RegisterNewAppointment`

The operation is accepted as intent-first. A caller may begin with only business identity + idempotency identity and then complete the appointment through Workflow Updates.

## Architecture

```text
CHANNEL / LAB CONSOLE
        ↓
CTA ADAPTER
  - validates syntax
  - normalizes human date input
  - never becomes business authority
        ↓
TEMPORAL
RegisterNewAppointment Workflow
        ↓
ACTIVITIES
        ↓
POSTGRESQL
  Customer truth
  Service catalog truth
  Product catalog truth
  Availability rule truth
  Appointment truth
        ↓
MONGODB
  appointment semantic audit/context
```

`RegisterNewCustomer` remains the only operation allowed to create a Customer. `RegisterNewAppointment` may resolve an existing Customer; when a Customer must be created, it executes `RegisterNewCustomer` as a Temporal Child Workflow rather than reimplementing customer creation.

## Conversation state machine

```text
STARTED
  ↓
WAITING_FOR_CUSTOMER
  ↓ customer draft / existing customer reference
RESOLVING_CUSTOMER
  ├─ existing Customer → CUSTOMER_READY
  └─ new Customer → child RegisterNewCustomer → CUSTOMER_READY
  ↓
LOADING_SERVICES
  ↓
WAITING_FOR_SERVICE
  ↓ select service
LOADING_PRODUCTS
  ↓
WAITING_FOR_PRODUCT
  ↓ select product
WAITING_FOR_DATE
  ↓ normalized date
LOADING_SLOTS
  ↓
WAITING_FOR_SLOT
  ↓ select slot
READY_TO_FINALIZE
  ↓ FinalizeAppointment
RESERVING_APPOINTMENT
  ↓ atomic PostgreSQL reservation
CREATED
```

Terminal failure is `FAILED`. Invalid conversational input does not fail the Workflow; it is rejected and the Workflow remains at the current durable step.

## Customer step

The caller can provide either:

1. `customerId` — resolve and verify an existing Customer in the same business.
2. Customer draft — name + phone/email/document as available.

Resolution order for the laboratory:

1. exact `customerId` when supplied;
2. exact document match;
3. exact normalized email/phone match when it resolves to exactly one Customer;
4. no match → execute child `RegisterNewCustomer` with `AUTO_WHEN_COMPLETE`;
5. multiple soft candidates → reject as ambiguous; no appointment may be persisted until the caller resolves the Customer explicitly.

The appointment Workflow never inserts directly into Customer tables.

## Service catalog

PostgreSQL owns the catalog.

### Service

A Service is the broad operational category, for example:

- `Car Wash`

### Product

A Product is a selectable concrete offering inside a Service, for example:

- `Basic Clean`
- `Executive Clean`
- `Salon Clean`

The Workflow must load active Services through an Activity after Customer resolution. It exposes the returned list in its Query projection. The caller selects one of those durable choices.

After service selection, the Workflow loads active Products for that Service through an Activity and exposes them in the Query projection.

No service/product list is hard-coded in Workflow code.

## Laboratory catalog fixture

Business: `golden-business`

Service:

```text
svc_car_wash | Car Wash
```

Products:

```text
prd_car_wash_basic      | Basic Clean      | 30 min
prd_car_wash_executive  | Executive Clean  | 30 min
prd_car_wash_salon      | Salon Clean      | 30 min
```

Thirty minutes is an MK0 fixture/configuration value only. It is not a universal Engines scheduling rule.

## Date input boundary

Human date input is channel syntax and must be normalized before it becomes Workflow state.

The Lab CTA supports at least:

- `2026-08-28`
- `28/08/2026`
- `28-08-2026`
- English weekday names such as `Friday`
- Spanish weekday names such as `viernes`

Relative weekday names mean the next occurrence on or after the business-local current date. Business timezone for the laboratory is `America/Lima`.

For the current example, from 2026-08-26:

```text
Friday  → 2026-08-28
viernes → 2026-08-28
```

The Workflow only receives a canonical `YYYY-MM-DD` appointment date.

Past dates are invalid. A rejected past date must not advance to slot selection.

## Availability authority

MK0 does not introduce a full Scheduler Engine.

PostgreSQL stores a narrow availability rule for this specimen:

```text
business + product/service + weekday
opening local time
closing local time
slot interval minutes
```

The first fixture uses 30-minute slots. The repository derives candidate slots from the rule and subtracts already-booked active appointments.

Example:

```text
06:00–06:30
06:30–07:00
07:00–07:30
```

The Query projection exposes those slots after a valid date is supplied.

## Conflict safety

Displaying an available slot is not a reservation.

At `FinalizeAppointment`, PostgreSQL must atomically insert the appointment under a uniqueness constraint for the business/resource/date/start time. If another execution took the slot after it was displayed, persistence returns `SLOT_CONFLICT` and the Workflow returns to `LOADING_SLOTS` / `WAITING_FOR_SLOT` with refreshed availability.

Thus:

```text
observed available != reserved
```

No appointment is considered created until PostgreSQL confirms the atomic reservation.

## First-lab resource model

The laboratory has one logical capacity resource:

```text
resource_key = default
```

Therefore only one active appointment may own a given start slot for `golden-business/default`.

This deliberately tests conflict semantics without pretending the full future resource model already exists.

## Workflow interaction primitives

Query:

- `GetAppointmentState`

Updates:

- `ProvideAppointmentCustomer`
- `SelectAppointmentService`
- `SelectAppointmentProduct`
- `SetAppointmentDate`
- `SelectAppointmentSlot`
- `FinalizeAppointment`

The Query projection includes:

- Workflow/Run identity
- phase/status
- customer resolution
- available Services
- selected Service
- available Products
- selected Product
- canonical appointment date
- available slots
- selected slot
- validation/rejection information
- `nextAction`
- terminal appointment ID/result

## Mandatory order

An appointment must never persist if any required step is absent.

The persistence gate requires all of:

```text
customerId
serviceId
productId
appointmentDate
selectedSlot
explicit FinalizeAppointment
```

## Error/rejection cases frozen for the first implementation

- unknown Customer ID
- ambiguous Customer match
- incomplete new-customer draft
- unknown/inactive Service
- Product not belonging to selected Service
- malformed date syntax at CTA
- date in the past
- no availability rule for date/product
- selected slot not in latest availability
- slot race/conflict at final persistence
- exact idempotency replay
- same idempotency key with materially different appointment intent

## Audit

MongoDB application events for this specimen use a separate appointment audit collection and include at least:

```text
APPOINTMENT_SESSION_STARTED
APPOINTMENT_CUSTOMER_RESOLVED
APPOINTMENT_SERVICE_SELECTED
APPOINTMENT_PRODUCT_SELECTED
APPOINTMENT_DATE_SELECTED
APPOINTMENT_SLOT_SELECTED
APPOINTMENT_FINALIZE_REQUESTED
APPOINTMENT_CREATED
APPOINTMENT_SLOT_CONFLICT
```

Temporal Event History remains orchestration truth. PostgreSQL remains business/catalog/appointment truth. MongoDB remains application semantic audit/context.

## First executable laboratory story

```text
new appointment wash01

customer set name Eduardo
customer set email eduardo@example.test
customer resolve

→ existing customer selected OR child RegisterNewCustomer creates one

services
→ Car Wash

service select svc_car_wash

products
→ Basic Clean
→ Executive Clean
→ Salon Clean

product select prd_car_wash_basic

date viernes
→ canonical 2026-08-28 for the 2026-08-26 example

slots
→ 06:00-06:30
→ 06:30-07:00
→ 07:00-07:30

slot select 06:30

show
→ READY_TO_FINALIZE

finish
→ atomic PostgreSQL reservation
→ Mongo audit
→ Temporal COMPLETED / CREATED
```

A second concurrent appointment choosing the same slot must not both succeed.

## Non-goals

Not part of this specimen:

- generic natural-language NLP engine
- arbitrary timezone scheduler
- staff/resource assignment engine
- recurring appointments
- reschedule/cancel workflows
- payments
- pricing/tax engine
- capacity > 1
- complete service administration UI
- external backend/service dependency

Those remain future Engines specimens/capabilities.
