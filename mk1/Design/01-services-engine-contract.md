# G1 — Services Engine Contract

## Status

**DESIGN CANDIDATE — PRE-BUILD**

This document defines the target contract that G1 must implement and certify. It deliberately builds on the MK0 `service_catalog` / `service_products` seed rather than introducing a disconnected parallel domain.

---

## 1. Responsibility

The Services Engine is the authoritative platform capability for:

> **What can this business offer, what selectable offering represents it, what does it cost/require, and is it eligible/recommendable under canonical business context?**

It does not own concrete calendar/resource availability.

```text
Services Engine
  ├── Service catalog
  ├── Offerings / packages
  ├── lifecycle
  ├── duration
  ├── pricing descriptor
  ├── requirements
  ├── dependencies
  ├── eligibility rules
  ├── deterministic recommendations
  └── revisioned snapshots

Scheduler Engine
  ├── resources/staff
  ├── schedules/overrides
  ├── capacity
  ├── concrete date/time availability
  ├── holds/reservations
  └── booking conflict lifecycle
```

---

## 2. Domain model

### 2.1 Service

A Service is the stable business-scoped category of work/offer.

Canonical projection:

```ts
type ServiceDefinition = {
  serviceId: string;
  businessSlug: string;
  code: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  revision: number;
  tags: readonly string[];
};
```

Rules:

- `serviceId` is opaque and stable.
- `code` is unique within one `businessSlug`.
- status controls new selection, not historical identity.
- revision is monotonic for material semantic changes.
- changing a display name does not create a new identity.

### 2.2 Offering

An Offering is the selectable variant/package under one Service.

It generalizes the existing MK0 `service_products` concept.

```ts
type ServiceOffering = {
  offeringId: string;
  serviceId: string;
  businessSlug: string;
  code: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  revision: number;
  durationMinutes: number;
  pricing: PricingDescriptor;
  priority: number;
  tags: readonly string[];
  requirements: readonly ServiceRequirement[];
  dependencies: readonly ServiceDependency[];
  eligibilityRuleSet?: EligibilityRuleSet;
};
```

Compatibility note:

- Existing `productId` is a legacy-compatible identifier surface.
- G1 may keep the physical `service_products` table/name for migration safety while exposing `offeringId` at the new domain contract.
- No runtime consumer may assume `Product` is the universal business term.

---

## 3. Pricing descriptor

G1 must model price semantics without pretending to solve full commerce/payment logic.

```ts
type PricingDescriptor =
  | { kind: 'FREE' }
  | { kind: 'FIXED'; amountMinor: number; currency: string }
  | { kind: 'FROM'; amountMinor: number; currency: string }
  | { kind: 'QUOTE_REQUIRED' };
```

Invariants:

- monetary values use integer minor units;
- currency uses an uppercase ISO-4217-style 3-letter code when money is present;
- negative amounts are invalid;
- `QUOTE_REQUIRED` has no fake amount;
- payment collection, tax calculation, discounts and refunds are outside G1.

---

## 4. Duration

For G1, each selectable schedulable Offering has one positive `durationMinutes` value.

The Services Engine owns this nominal duration as catalog truth. Scheduler later consumes it as an input when computing capacity.

G1 does not yet require variable-duration formulas.

---

## 5. Requirements

Requirements are canonical prerequisites, not UI fields.

```ts
type ServiceRequirement = {
  code: string;
  kind:
    | 'CUSTOMER_DATA'
    | 'DOCUMENT'
    | 'CONSENT'
    | 'ENTITY_ATTRIBUTE'
    | 'RESOURCE_CAPABILITY'
    | 'PRECONDITION';
  required: boolean;
  config: Readonly<Record<string, unknown>>;
};
```

A requirement may tell the Workflow what information/capability must exist. The CTA decides only how to render or collect it.

The Services Engine does not directly mutate Customer/ManagedEntity state to satisfy requirements.

---

## 6. Dependencies

G1 supports explicit direct Offering dependencies:

```ts
type ServiceDependency = {
  relation: 'REQUIRES' | 'EXCLUDES';
  targetOfferingId: string;
};
```

Rules:

- dependencies are business-scoped;
- self-dependency is invalid;
- a target must exist;
- contradictory direct `REQUIRES` + `EXCLUDES` pairs are invalid;
- workflow sequencing beyond these simple relationships remains a Workflow Library concern.

---

## 7. Eligibility rules

G1 must avoid arbitrary executable code or `eval` stored in the database.

A small deterministic predicate model is sufficient:

```ts
type EligibilityPredicate = {
  path: string;
  operator: 'EXISTS' | 'EQ' | 'IN' | 'GTE' | 'LTE';
  value?: unknown;
};

type EligibilityRuleSet = {
  mode: 'ALL';
  predicates: readonly EligibilityPredicate[];
  failureCode: string;
};
```

Canonical context is a plain structured object supplied by the calling Workflow/Activity.

Rules:

- missing referenced values evaluate deterministically;
- type mismatches fail closed with a typed reason rather than coercing unpredictably;
- rule evaluation is pure and side-effect free;
- no LLM/Agent is used for the certification path.

---

## 8. Recommendation

Recommendation is deterministic filtering + stable ranking over active Offerings.

Input:

```ts
type RecommendOfferingsInput = {
  businessSlug: string;
  serviceId?: string;
  context: Readonly<Record<string, unknown>>;
  limit?: number;
};
```

Output:

```ts
type OfferingRecommendation = {
  offering: ServiceOfferingSnapshot;
  eligible: boolean;
  reasonCodes: readonly string[];
};
```

Ordering for eligible results:

```text
priority DESC
name ASC
offeringId ASC
```

A recommendation result must expose reason codes sufficient to audit why an Offering was included/excluded.

---

## 9. Revision and snapshot semantics

### 9.1 Requirement

A running Temporal Workflow must not silently change selected semantics when the catalog changes.

### 9.2 Contract

Every Service and Offering read includes an explicit `revision`.

Selection creates a durable snapshot containing all semantics required by the current workflow, at minimum:

```text
offeringId
serviceId
businessSlug
serviceRevision
offeringRevision
name/code
durationMinutes
pricing
requirements relevant to the workflow
```

New catalog revisions affect new reads. Existing running Workflow state retains its previously selected snapshot unless an explicit workflow operation chooses to refresh/reselect.

### 9.3 Mutation model

G1 catalog writes, if included, use optimistic revision checks:

```text
expectedRevision = N
currentRevision  = N   → update succeeds, revision N+1
currentRevision != N   → REVISION_CONFLICT
```

No silent last-writer-wins for material service semantics.

---

## 10. Persistence model

PostgreSQL remains canonical Services truth.

Recommended migration path:

```text
existing service_catalog
  + description
  + status/lifecycle normalization
  + revision
  + tags

existing service_products
  interpreted as Offerings
  + pricing fields
  + revision
  + priority
  + tags

new service_requirements
new service_dependencies
new service_eligibility_rules
```

JSONB may be used for typed rule/config payloads where schema flexibility is intentional, but core identity, lifecycle, references, revisions and monetary invariants remain relationally constrained.

MongoDB may record Services mutation/evaluation audit if the G1 workflow contract requires it; it must not duplicate the catalog as canonical truth.

---

## 11. Service Engine read ports

Minimum independently testable operations:

```text
ListServices(businessSlug)
GetService(businessSlug, serviceId|code)
ListOfferings(businessSlug, serviceId)
GetOffering(businessSlug, offeringId|code)
EvaluateOfferingEligibility(context, offering)
RecommendOfferings(context, optional service scope)
```

These operations return canonical domain projections and do not depend on Telegram/CLI/Postman presentation.

---

## 12. Mutation ports

For a complete Services Engine rather than a read-only fixture, G1 should certify versioned writes:

```text
CreateService
UpdateService
SetServiceStatus
CreateOffering
UpdateOffering
SetOfferingStatus
```

Mutations must be:

- business-scoped;
- idempotent at the operation boundary;
- revision-aware;
- auditable;
- executed through the orchestration/persistence authority rules frozen by G0.

A minimal Temporal management Workflow may orchestrate these mutations. Direct public/channel writes to PostgreSQL are forbidden.

---

## 13. Multi-business isolation

Every query/mutation uses `businessSlug` as part of the authority scope.

The same Service/Offering codes may exist in different businesses without collision.

No query may retrieve another business's catalog by ID alone unless the internal contract has already resolved and validated the owning scope.

---

## 14. G1 certification specimens

At least two materially different business definitions must use the same engine implementation.

Proposed synthetic fixtures:

```text
Business: golden-auto
Service: Vehicle Care
Offering: Basic Wash
Pricing: FIXED PEN 3500
Duration: 30
Requirement: none

Business: golden-vet
Service: Consultation
Offering: General Consultation
Pricing: FIXED PEN 8000
Duration: 45
Requirement: customer contact + entity attribute(species)
```

A second Offering should exercise `QUOTE_REQUIRED`, dependency or eligibility behavior.

The implementation must contain no branch on `golden-auto`, `golden-vet`, `automotive`, `veterinary`, or equivalent vertical labels.

---

## 15. Required negative behavior

G1 must reject or deterministically classify:

- unknown business scope;
- duplicate service/offering code in one business;
- cross-business Service/Offering reference;
- inactive Service/Offering for new selection;
- invalid/zero duration;
- malformed currency/negative price;
- missing dependency target;
- self/contradictory dependency;
- invalid eligibility predicate;
- optimistic revision conflict;
- same idempotency identity with different mutation material.

---

## 16. G1 closure claim

Only after executable evidence exists may the repository state:

> **The Services Engine is certified as a business-scoped, versioned catalog and rules capability supporting reusable Services/Offerings, lifecycle, duration, pricing descriptors, requirements, dependencies, deterministic eligibility/recommendation and idempotent/revision-safe management without vertical-specific business code.**

Until then, Services remains `DESIGN / BUILD IN PROGRESS`.
