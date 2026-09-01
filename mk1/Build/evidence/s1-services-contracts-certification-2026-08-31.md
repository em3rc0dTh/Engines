# S1 — Services Engine Contracts + Persistence Certification

Date: 2026-08-31 (America/Lima)

Status: **PASS — SERVICES CONTRACT/PERSISTENCE FOUNDATION CERTIFIED**

## Scope

S1 promotes the MK0 Service/Product catalog seed into the first independently tested Services Engine domain/persistence contract. It does **not** yet certify the full read engine, deterministic recommendation runtime, versioned management workflows, or running-Workflow snapshot behavior; those remain S2–S5.

## Certified source

```text
Branch      build/mk1-s1-services-contracts
Source SHA  550cdca619856fe246ab569588f9036a7025e7a7
```

## Implemented contract surface

### Canonical domain types

Added under `mk1/runtime/src/contracts/services-engine/`:

```text
ServiceDefinition
ServiceOffering
ServiceOfferingSnapshot
PricingDescriptor
ServiceRequirement
ServiceDependency
EligibilityPredicate
EligibilityRuleSet
```

The new domain uses neutral `Offering` semantics while retaining the existing `service_products` physical table for compatibility.

### Pricing contract

Certified descriptor shapes:

```text
FREE
FIXED(amountMinor, currency)
FROM(amountMinor, currency)
QUOTE_REQUIRED
```

Money uses non-negative integer minor units. Monetary descriptors require an uppercase three-letter currency. `FREE` and `QUOTE_REQUIRED` cannot carry fabricated amount/currency material.

### Persistence migration

Migration `005_services_engine_contracts.sql` evolves the certified catalog in place with:

```text
service_catalog
  + description
  + revision
  + tags
  + generated ACTIVE/INACTIVE status

service_products / Offering compatibility
  + revision
  + priority
  + tags
  + typed pricing columns
  + generated ACTIVE/INACTIVE status

service_requirements
service_dependencies
service_eligibility_rules
```

Cross-business requirement/dependency references are constrained through business-scoped composite foreign keys. Direct contradictory dependency pairs are prevented by a unique source/target pair regardless of relation.

The previous MK0 Car Wash seed survives the migration as revision 1 and receives the truthful compatibility default `QUOTE_REQUIRED` rather than an invented price.

## Contract test proof

```text
Services S1 tests   10 / 10 PASS
```

Covered behavior includes:

- fixed-price minor units;
- free/quote-required no-money invariant;
- negative price rejection;
- malformed currency rejection;
- positive bounded duration;
- canonical requirements;
- self-dependency rejection;
- deterministic eligibility rule shape;
- malformed rule fail-closed behavior;
- business/revision/tag validation.

## Regression proof

The inherited fast contract surface remained green:

```text
Customer contracts      21 / 21 PASS
CLI CTA                   7 /  7 PASS
AttachmentStore           6 /  6 PASS
Appointment date          6 /  6 PASS
-----------------------------------
Inherited subset         40 / 40 PASS
```

Combined contract tests executed in this gate:

```text
Services S1              10 / 10
Inherited                40 / 40
--------------------------------
Total                    50 / 50 PASS
```

## Clean Compose proof

The complete Compose laboratory booted successfully with migration 005 inserted into the normal migration chain.

The database semantics probe returned:

```text
SERVICES_S1_PERSISTENCE_PASS
```

with verified facts:

```json
{
  "inheritedCatalogPreserved": true,
  "generatedLifecycle": true,
  "revisionColumns": true,
  "pricingConstraints": true,
  "requirementBusinessScope": true,
  "dependencyConstraints": true,
  "eligibilityShapeConstraint": true
}
```

## Appointment compatibility regression

After the Services migration, the existing durable Appointment specimen still passed:

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

The historical marker retains its `MK0_` name because the inherited certification script has not been cosmetically rewritten.

## GitHub Actions evidence

```text
Workflow  mk1 S1 Services contracts certification
Run       33461510248
Job       99712416091
Result    success
```

Artifact:

```text
Name      mk1-s1-services-contracts-33461510248
ID        9783331341
Size      4940 bytes
SHA-256   7f69bf9d33b2e854d5cc4941b41059dc358437675cf0bbb6d102c29f129b2097
```

## Authority check

S1 preserves the G0 rules:

- PostgreSQL remains canonical catalog truth.
- No CTA/channel code was given direct catalog persistence authority.
- No Workflow code was given a database driver.
- Eligibility is represented as typed data, not stored executable JavaScript/SQL.
- Scheduler date/time/resource authority was not moved into Services.
- `mk0/runtime` remains frozen.

## S1 verdict

**S1 PASS.**

The repository may now truthfully claim:

> **The MK1 Services Engine has a certified canonical contract and relational persistence foundation for revisioned Services/Offerings, lifecycle, typed pricing, requirements, dependencies, and deterministic eligibility-rule data, while preserving the certified Appointment path and MK0 authority boundaries.**

This does not yet certify Services read/recommendation behavior.

## Next gate

```text
S2 — Deterministic read engine
```
