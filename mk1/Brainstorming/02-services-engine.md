# Brainstorming — G1 Services Engine

## Status

**ACTIVE DESIGN BRAINSTORMING — NO CERTIFICATION CLAIM YET**

## Why this engine is next

MK0 already proved that `RegisterNewAppointment` can read a Service and Product catalog from PostgreSQL and use those selections inside a durable Temporal Workflow. That is strong evidence that the Services Engine seed exists.

It is not yet a certified engine because the current seed is intentionally small:

```text
Service: Car Wash
Products: Basic / Executive / Salon Clean
duration: 30 min
active: true
```

The next question is therefore:

> Can Engines represent, validate, query and deterministically evaluate reusable business service definitions without embedding vertical-specific logic in the channel or workflow?

## Core idea

The Services Engine should answer **what a business can offer and under what business conditions**.

It should not answer **when a resource is free**. That belongs to Scheduler.

```text
SERVICES ENGINE
  owns:
  - catalog identity
  - offerings/packages
  - description
  - lifecycle
  - duration semantics
  - pricing descriptor
  - requirements
  - dependencies
  - eligibility/business rules
  - deterministic recommendation eligibility/ranking
  - versioned service definition

SCHEDULER ENGINE
  owns later:
  - staff/resources
  - schedules/overrides
  - capacity
  - concrete date/time availability
  - holds/reservations
  - conflicts
  - reschedule/cancel capacity lifecycle
```

This boundary is important because `service_availability_rules` in the MK0 fixture currently mixes catalog and scheduling concerns. G1 should not cement that laboratory shortcut into the final Services contract.

## Product / Package naming

The current database uses `service_products`. The target architecture calls the concept `Categories & Packages`, and real businesses may call it a package, plan, treatment, rental option, consultation type, service tier, etc.

The domain concept should therefore be neutral.

Working proposal:

```text
Service
  ↓
Offering
```

`Offering` is the selectable commercial/operational variant of a Service. Existing `productId` can remain compatible during migration, but the long-term contract should not require every vertical to call an offering a Product.

## Pricing brainstorming

A single `price` number is too narrow. Some services are free, fixed-price, start-from, or require a quote.

Proposed typed descriptor:

```text
FREE
FIXED(amountMinor, currency)
FROM(amountMinor, currency)
QUOTE_REQUIRED
```

Dynamic taxation, discounts, payment collection and full commerce policy are not Services Engine responsibilities.

## Duration brainstorming

Duration belongs to the service/offering definition because Scheduler needs it as an input.

The engine should express:

- nominal duration;
- optional minimum/maximum only if a use case proves it necessary later.

For G1 the simplest truthful contract is one positive `durationMinutes` per schedulable offering.

## Requirements

Requirements describe prerequisites to perform/select an offering, not channel-specific forms.

Examples:

```text
customer must provide document
customer must accept consent
managed entity must have attribute X
resource capability Y will be required
precondition Z must be true
```

The Services Engine should return requirements in canonical form. A Workflow/channel can then collect missing information without owning the rule.

## Dependencies

Some offerings depend on or exclude others. The engine should support explicit references rather than hard-coded workflow branches.

Working relations:

```text
REQUIRES
EXCLUDES
```

More complex workflow sequencing can remain a Workflow Library concern.

## Deterministic recommendation

G1 recommendation must work **without an Agent**.

The engine should be able to take canonical context and return eligible offerings using deterministic rules and stable ordering.

This is deliberately not semantic/LLM recommendation.

Example:

```text
context
  ↓
eligibility rules
  ↓
eligible offerings
  ↓
priority + stable tie-break
  ↓
recommendation result + reason codes
```

Later an Agent may help produce context or explain results, but cannot invent an offering that the Services Engine marks ineligible.

## Versioning question

A running Temporal Workflow can wait for minutes, hours or days. If a catalog entry changes while it is waiting, its semantics must not silently mutate.

G1 should therefore make version/revision explicit.

Working rule:

> Read/selection returns a revisioned service/offering snapshot. Running workflows retain that snapshot/revision. New reads see the newer active revision.

## Multi-business proof

Car Wash alone cannot certify generality.

The Golden test should include at least two materially different definitions using the same code path, for example:

```text
Business A — Automotive
Service: Vehicle Cleaning
Offering: Basic Wash

Business B — Veterinary
Service: Consultation
Offering: General Consultation
```

The implementation must contain no business-name/vertical switch.

## Non-goals for G1

- actual calendar slot generation;
- staff/resource scheduling;
- ResourceReservation;
- booking/reschedule/cancel;
- payment collection;
- notification delivery;
- Agent/LLM intent classification;
- Ground Control UI;
- production deployment.

## Closure question

G1 closes only when we can truthfully say:

> **A Temporal workflow can consume a versioned, business-scoped Services Engine that returns deterministic catalog, requirements, pricing/duration and eligibility/recommendation results for materially different service definitions without vertical-specific code.**
