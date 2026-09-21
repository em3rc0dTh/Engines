# G1 — Services Engine Completion Contract (S6–S8)

## Status

**S0–S5 CERTIFIED — S6–S8 DESIGN FOR CLOSURE**

This document is an addendum to `01-services-engine-contract.md`. It does not replace already-certified S0–S5 evidence.

## 1. What is already proven

```text
S0 runtime promotion                  CERTIFIED
S1 contracts + persistence            CERTIFIED
S2 deterministic reads                CERTIFIED
S3 eligibility + recommendation       CERTIFIED
S4 versioned management               CERTIFIED
S5 durable Workflow snapshots         CERTIFIED
```

The remaining work is not to redesign Services from zero. It is to prove generality, migrate Appointment consumption to canonical Service/Offering semantics, and close the engine cleanly.

## 2. S6 — multi-business generality

S6 must prove the same Services implementation works for materially different businesses without vertical branches.

Minimum specimens:

```text
golden-auto
  Service: Vehicle Care
  Offering: Basic Wash
  duration 30m
  fixed PEN pricing

golden-vet
  Service: Consultation
  Offering: General Consultation
  duration 45m
  customer/entity requirements
```

Required assertions:

```text
same code path
business-scoped identity
same codes allowed across businesses
cross-business reads rejected
cross-business dependencies rejected
eligibility remains deterministic
management replay/revision behavior unchanged
```

Forbidden:

```text
if business == golden-auto
if vertical == veterinary
switch industry
```

## 3. Scheduling requirements extension

To compose Step 3 with Step 4, an Offering may expose abstract resource/capacity requirements.

Candidate addition to Offering snapshot:

```ts
type SchedulingRequirement = Readonly<{
  capacityUnits: number;
  capabilities: readonly {
    code: string;
    quantity: number;
    resourceKinds?: readonly string[];
  }[];
  buffers?: {
    beforeMinutes?: number;
    afterMinutes?: number;
  };
}>;
```

Rules:

- this is **abstract demand**, not concrete assignment;
- no `employeeId`, `roomId`, `bayId`, etc. is required as generic Service catalog truth;
- capability codes are business-scoped vocabulary/data;
- Scheduler validates whether concrete resources can satisfy them;
- selected Workflow snapshot freezes this requirement together with duration/revisions.

## 4. OfferingSnapshot closure shape

A scheduling-capable selected Offering should carry at minimum:

```ts
type OfferingSnapshot = Readonly<{
  businessSlug: string;
  serviceId: string;
  serviceRevision: number;
  offeringId: string;
  offeringRevision: number;
  code: string;
  name: string;
  durationMinutes: number;
  pricing: PricingDescriptor;
  requirements: readonly ServiceRequirement[];
  dependencies: readonly ServiceDependency[];
  scheduling?: SchedulingRequirement;
}>;
```

This is the semantic contract passed forward. A running Workflow must not substitute mutable catalog head for this snapshot.

## 5. S7 — Appointment integration

Current Appointment still carries legacy `selectedProduct` compatibility. S7 should migrate the Workflow to canonical Services reads/snapshots while preserving existing behavior.

Target sequence before Scheduler implementation replaces slot logic:

```text
Appointment
→ ListServices
→ select Service
→ ListOfferings
→ select Offering
→ freeze OfferingSnapshot
→ remaining current Appointment flow
```

Compatibility may expose legacy `productId` aliases at boundaries, but business logic should use `offeringId` semantics internally.

S7 does **not** need to claim Scheduler integration. It needs to prove Appointment is consuming the real Services Engine rather than a parallel legacy catalog path.

## 6. S7 snapshot requirement

During one Appointment Workflow:

```text
select Offering revision N
publish Offering revision N+1
continue Appointment
→ selected semantics remain N
```

If S5 already proves the underlying snapshot primitive, S7 must prove Appointment actually uses it.

## 7. S8 — final G1 closure

S8 is a clean-lab certification that re-runs the complete Services scope:

```text
S1 persistence/contracts
S2 reads
S3 eligibility/recommendation
S4 management
S5 snapshots/restart
S6 multi-business
S7 Appointment integration
```

No stale fixture/legacy direct catalog read may bypass the engine in the certified Appointment path.

## 8. Services / Scheduler handoff

After S8, Services can be considered semantically complete enough for Scheduler composition.

```text
OfferingSnapshot
   ↓ derive
SchedulingDemand
   ↓
Scheduler
```

Scheduler is not allowed to alter/reinterpret Service pricing, eligibility or commercial requirements.

## 9. Non-claims

Closing G1 will not by itself certify:

```text
Scheduler availability
resource assignments
holds/reservations
payments
Integration Engine
Telegram physical delivery
Agent/MCP
production readiness
```
