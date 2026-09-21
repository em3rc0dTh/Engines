# Quarry 01 — MK0 Services Seed

## Status

**EXTRACTED FROM CERTIFIED MK0 RUNTIME + DESIGN**

## Purpose

Capture exactly what MK0 already proves about Services behavior so G1 can reuse evidence without inflating it into a finished Services Engine claim.

## Sources

- `mk0/runtime/migrations/004_appointment_catalog_and_booking.sql`
- `mk0/runtime/src/persistence/postgres/appointment.repository.ts`
- `mk0/runtime/src/contracts/register-new-appointment/types.ts`
- `mk0/runtime/src/orchestration/temporal/workflows/register-new-appointment.workflow.ts`
- `mk0/Build/evidence/mk0-register-new-appointment-certification-2026-08-26.md`
- `mk0/mining-site/quarries/quarry-05-register-new-appointment.md`

## Extracted facts

### 1. Business-scoped Service rows already exist

Current table:

```text
service_catalog
- service_id
- business_slug
- service_code
- service_name
- active
- timestamps
```

Uniqueness is scoped by `(business_slug, service_code)`.

Classification: `CERTIFIED_RUNTIME_SEED`.

### 2. Selectable Product rows already exist

Current table:

```text
service_products
- product_id
- service_id
- business_slug
- product_code
- product_name
- description
- duration_minutes
- active
- timestamps
```

The repository reads active Products by `(businessSlug, serviceId)` and returns deterministic ordering.

Classification: `CERTIFIED_RUNTIME_SEED`.

### 3. Appointment reads catalog truth through Activities

`RegisterNewAppointment` does not hard-code the visible Service/Product choices. It calls Activities that read PostgreSQL catalog truth and then waits for durable selection Updates.

Classification: `CERTIFIED_RUNTIME_FACT`.

### 4. Service/Product relationship is enforced by lookup scope

Products are loaded only for the selected Service. Selection rejects a Product not present in the current returned set.

Classification: `CERTIFIED_RUNTIME_FACT`.

### 5. Duration exists, pricing does not

The current Product contract contains `durationMinutes`.

No canonical price/currency contract exists in MK0.

Classification:

```text
duration       PROVEN SEED
pricing        ABSENT
```

### 6. Requirements/dependencies are absent

There is no certified representation of:

- customer/entity requirements;
- prerequisites;
- offering dependencies;
- exclusion rules;
- consent/document requirements at Service level.

Classification: `ABSENT`.

### 7. Recommendation is absent

The current Workflow displays/accepts selectable Services and Products. It does not evaluate canonical recommendation rules or rank eligible offerings from context.

Classification: `ABSENT`.

### 8. Revision/version semantics are absent

Rows have `updated_at`, but there is no explicit immutable revision contract captured by a running Workflow.

A long-running Workflow could therefore read a Service/Product whose mutable database fields later change without a certified rule explaining which semantics should apply.

Classification: `G1 DESIGN GAP`.

### 9. Current availability table belongs to the scheduling seed

`service_availability_rules` currently contains weekday/open/close/slot/resource data.

That table was introduced only as a laboratory mechanism for `RegisterNewAppointment`. Quarry 05 already states it is not the final Scheduler architecture.

G1 consequence:

> Services Engine may expose scheduling requirements/capability constraints, but concrete date/time/resource availability authority must remain for Scheduler.

Classification: `BOUNDARY CONSTRAINT`.

### 10. Generality is not yet proven

The certified fixture uses one business and one Service family (`Car Wash`) with three similar Products.

That proves the orchestration/catalog seam, not vertical-neutral modeling.

Classification: `G1 CERTIFICATION GAP`.

## Reusable seed vs missing engine

```text
BUSINESS-SCOPED IDENTITY       ✅ seed exists
SERVICE ACTIVE LIFECYCLE       ✅ seed exists
OFFERING/PRODUCT RELATION      ✅ seed exists
DESCRIPTION                    ✅ seed exists
DURATION                       ✅ seed exists
DETERMINISTIC READS            ✅ seed exists
TEMPORAL ACTIVITY CONSUMPTION  ✅ proven

PRICING                        ❌ absent
REQUIREMENTS                   ❌ absent
DEPENDENCIES                   ❌ absent
ELIGIBILITY RULES              ❌ absent
RECOMMENDATION                 ❌ absent
EXPLICIT REVISIONING           ❌ absent
MULTI-BUSINESS GENERALITY      ❌ not certified
SERVICE AUDIT/CHANGE EVIDENCE  ❌ not independently certified
```

## G1 design consequence

G1 should evolve the existing seed rather than create a parallel catalog model. Compatibility/migration from `service_catalog` and `service_products` must be explicit.
