# Quarry 05 — RegisterNewAppointment Orchestration

## Status

**EXTRACTED FROM SECOND-SPECIMEN DESIGN + CERTIFIED RUNTIME**

## Purpose

Capture only the reusable conclusions learned from the second MK0 specimen so future Engines work does not accidentally treat the Car Wash fixture as the final Scheduler design.

## Sources

- `mk0/Design/07-register-new-appointment-specimen.md`
- `mk0/Build/evidence/mk0-register-new-appointment-certification-2026-08-26.md`
- certified runtime source `70ab427f34bf353a7239f2f87bbe3b4889ec1efd`
- GitHub Actions run `33014515270`

## Extracted conclusions

### 1. Workflow composition is preferable to duplicated authority

`RegisterNewAppointment` does not create Customer rows directly.

```text
appointment needs Customer
→ resolve existing Customer
→ if absent: Child Workflow RegisterNewCustomer
→ receive customerId
→ continue appointment conversation
```

Classification: `DESIGN_DECISION` + `CERTIFIED_RUNTIME_FACT`.

### 2. Catalog truth is external business truth

Service and Product choices are read from PostgreSQL through Activities. They are not hard-coded into Workflow state as permanent platform truth.

Classification: `DESIGN_DECISION` + `CERTIFIED_RUNTIME_FACT`.

### 3. Human date input is a CTA normalization concern

Examples such as:

```text
Friday
viernes
28/08/2026
ayer / yesterday
mañana / tomorrow
```

are translated at the CTA boundary into a canonical business-local date or a typed rejection before the Workflow consumes the canonical value.

Classification: `DESIGN_DECISION`.

### 4. Displayed availability is not a reservation

Two Workflows may legitimately observe the same slot as available before either persists it.

Therefore finalization must revalidate and reserve capacity atomically in the business authority.

Certified race behavior:

```text
Workflow A sees 07:00 available
Workflow B sees 07:00 available
A finishes first → BOOKED
B finishes second → SLOT_NOT_AVAILABLE
B remains RUNNING and receives refreshed availability
```

Classification: `DESIGN_REQUIREMENT` + `CERTIFIED_RUNTIME_FACT`.

### 5. Explicit finalization is a separate human decision

Having Customer + Service + Product + Date + Slot is sufficient to reach `READY_TO_FINALIZE`, but not sufficient to create an Appointment.

```text
READY_TO_FINALIZE
≠
Appointment persisted
```

Only explicit finalization authorizes booking in the interactive specimen.

Classification: `DESIGN_DECISION` + `CERTIFIED_RUNTIME_FACT`.

## Important non-conclusion

The MK0 Appointment fixture uses:

- one `default` resource;
- local PostgreSQL `service_availability_rules`;
- 30-minute Product duration/slot interval;
- a simple unique constraint to protect the resource/date/start tuple.

This proves orchestration and concurrency behavior only.

It does **not** replace the future TimeSlots/Scheduler architecture preserved by Quarry 01.

Future Scheduler work must separately decide and certify schedule rules, overrides, capacity, `ResourceReservation`, hold/expiry semantics, variable service duration and multi-resource allocation.

Classification: `SCOPE_BOUNDARY`.
