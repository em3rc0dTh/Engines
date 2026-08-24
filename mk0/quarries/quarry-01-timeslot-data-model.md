# Quarry 01 — TimeSlot Data Model

## Status

**EXTRACTED / READY FOR DESIGN USE**

## Source

`DATA_MODEL_VTKALL_DataModel-0_v3_timeslots.md`

## Extraction relevant to mk0

### Customer

The target `Customer` model includes, conceptually:

- `businessSlug`;
- `type`;
- `name`;
- document metadata;
- contact phones;
- contact email;
- WhatsApp metadata;
- business metrics;
- notes;
- status;
- created/updated timestamps.

`ManagedEntity` is separate from Customer in the target model. Therefore RegisterNewCustomer should not force vertical-specific assets/entities into the Customer document.

Classification: `SOURCE_FACT`.

### Appointment vs ResourceReservation

Canonical rule:

```text
Appointment schedules the customer-facing appointment.
ResourceReservation blocks real operational capacity.
```

Classification: `SOURCE_FACT`.

### Availability

Canonical future calculation:

```text
availability
= WorkTeamScheduleRule
+ WorkTeamScheduleOverride
- blocking ResourceReservation
```

Classification: `SOURCE_FACT`.

### Micro-slots

Default recommended unit:

`15 minutes`

A service may consume multiple micro-slots.

Classification: `SOURCE_FACT`.

### Reservation blocking states

Only:

- `held`;
- `booked`;

block capacity.

Non-blocking:

- `cancelled`;
- `released`;
- `expired`.

Classification: `SOURCE_FACT`.

### AvailabilitySlot

`AvailabilitySlot` is retained only for legacy compatibility and should not become the future availability authority.

Classification: `SOURCE_FACT`.

---

## Consequence for RegisterNewCustomer

The first mk0 workflow must create **zero scheduling side effects**.

It does not create:

- Appointment;
- ResourceReservation;
- AvailabilitySlot;
- WorkTeam schedule mutation.

Classification: `PROJECT_DECISION` derived from first-workflow scope and the source separation above.

---

## Boundary preserved for future Scheduler Engine

When Scheduler is introduced, it should not infer availability from appointments alone.

It must use the TimeSlots operational layer and create `ResourceReservation` when actual capacity is blocked.

This future rule is preserved now so mk0 customer registration does not create a legacy shortcut that later needs removal.
