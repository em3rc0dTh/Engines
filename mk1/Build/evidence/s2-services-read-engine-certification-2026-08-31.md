# S2 — Services Engine Deterministic Read Certification

Date: 2026-08-31 (America/Lima)

Status: **PASS — DETERMINISTIC SERVICES READ ENGINE CERTIFIED**

## Scope

S2 certifies the read side of the Services Engine over the S1 relational contract. It does not yet certify deterministic eligibility/recommendation decisions or versioned management mutations.

## Certified source

```text
Branch      build/mk1-s2-services-read-engine
Source SHA  cec97a2b90a7aee8ae1deb3660bad0d7a759ace6
```

## Implemented read surface

PostgreSQL-backed Services repository:

```text
ListServices(businessSlug)
GetService(businessSlug, serviceId|code)
ListOfferings(businessSlug, serviceId)
GetOffering(businessSlug, offeringId|code)
```

Temporal Activity-facing wrappers were added so future Workflows can consume the read engine through Activities rather than importing a database driver.

## Certified semantics

### Deterministic Service reads

`ListServices`:

- is scoped by `businessSlug`;
- returns active Services only for new selection;
- orders by `service_name ASC, service_id ASC`;
- returns revision, lifecycle status, description and tags.

Explicit `GetService` remains business-scoped and can resolve an inactive historical identity with its `INACTIVE` status.

### Deterministic Offering reads

`ListOfferings`:

- is scoped by business and selected Service;
- requires both Service and Offering to be active for new selection;
- orders by `priority DESC, product_name ASC, product_id ASC`;
- returns revision, duration, typed pricing, tags, requirements, dependencies and eligibility-rule data.

Explicit `GetOffering` remains business-scoped and can resolve inactive historical identity.

### Business isolation

The certification seeded the same Service code in two distinct businesses and proved that each resolves only inside its own `businessSlug`. Lookup by another business's opaque Service or Offering id returned no object.

### Appointment compatibility

A pure compatibility projection maps the generic Services domain into the inherited Appointment contracts without putting catalog policy into Appointment:

```text
ServiceDefinition -> AppointmentService
ServiceOffering    -> AppointmentProduct
```

A revision-aware `ServiceOfferingSnapshot` helper captures both Service and Offering revisions plus duration/pricing/requirements for future durable Workflow selection semantics.

## Test proof

```text
S1 Services contracts     10 / 10 PASS
S2 compatibility           4 /  4 PASS
Customer contracts        21 / 21 PASS
CLI CTA                     7 /  7 PASS
AttachmentStore             6 /  6 PASS
Appointment date            6 /  6 PASS
--------------------------------------
Total                      54 / 54 PASS
```

## Clean Compose runtime proof

The clean Docker Compose laboratory booted with S1 migrations and the S2 read implementation. The runtime probe emitted:

```text
SERVICES_S2_READ_ENGINE_PASS
```

with observed result:

```json
{
  "serviceOrder": ["Alpha Service", "Zulu Service"],
  "offeringOrder": ["Alpha Offering", "Beta Offering", "Low Offering"],
  "businessIsolation": true,
  "inactiveListFiltering": true,
  "explicitHistoricalLookup": true,
  "fullOfferingHydration": true,
  "appointmentCompatibility": true,
  "revisionSnapshot": true,
  "verticalNeutralRepository": true
}
```

The probe also statically rejected known synthetic vertical/business tokens inside the repository implementation to guard against a hidden automotive/veterinary switch in the read engine.

## Appointment regression

After the new Services read engine was added, the inherited durable Appointment certification still passed:

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

S2 does not yet replace Appointment's existing catalog Activities with the new Services Activities; that integration remains S7. The compatibility projection proves that the domain contract can be consumed without changing Scheduler semantics.

## GitHub Actions evidence

```text
Workflow  mk1 S2 Services read engine certification
Run       33461895218
Job       99713587556
Result    success
```

Artifact:

```text
Name      mk1-s2-services-read-engine-33461895218
ID        9783467265
Size      3669 bytes
SHA-256   0b7c0addd1849da87fe03afc93053a5df7c3fddf674f9baf5a78e3400d9a3677
```

## Authority check

S2 preserves the frozen architecture:

- PostgreSQL is canonical Services truth.
- Workflow code has no database driver.
- Temporal Activities form the future orchestration side-effect/read boundary.
- inactive definitions remain identifiable historically but cannot enter active selection lists.
- business scope is explicit on every public repository operation.
- no Scheduler slot/resource calculation moved into Services.
- `mk0/runtime` remains frozen.

## S2 verdict

**S2 PASS.**

The repository may now truthfully state:

> **The Services Engine can deterministically read business-scoped, revisioned Services and Offerings—including pricing, duration, requirements, dependencies and eligibility-rule data—with active-selection filtering, historical explicit lookup, cross-business isolation and Appointment-compatible projections.**

This does not yet certify recommendation decisions.

## Next gate

```text
S3 — Eligibility + deterministic recommendation
```
