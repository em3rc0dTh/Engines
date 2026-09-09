# ME1 — Managed Entity Resolution Test Plan

Date: 2026-09-09

## Current implemented scope

ME-G0 policy contract is implemented as a pure deterministic decision boundary.

Implementation:

```text
mk1/runtime/src/contracts/register-new-appointment/managed-entity-policy.ts
mk1/runtime/src/contracts/register-new-appointment/managed-entity-policy.test.ts
```

The existing `test:appointment` command includes all `register-new-appointment/*.test.ts`, so this suite is part of appointment contract regression.

## ME-G0 assertions

```text
Gallo + 0 vehicles       → CREATE_NEW
Gallo + 1 vehicle        → SELECT explicitly
Gallo + N vehicles       → SELECT compatible candidates
Gallo + wrong type only  → CREATE_NEW
BateYLate + old requests → CREATE_NEW_DEFAULT
```

## Why explicit selection for one durable subject

The workflow must establish the subject intentionally. `AUTO_IF_SINGLE` remains available as a policy option, but Gallo's initial fixture uses `ALWAYS_EXPLICIT` so the CTA asks/affirms which vehicle receives the work.

## Why create-new default for BateYLate

A prior dessert request is historical context, not necessarily the subject of today's custom order. Reusing it must be an explicit repeat/clone intent, not an accidental default.

## Next physical proof

After ME-G1..ME-G4 are implemented:

```text
WebChat
→ resolve existing Customer
→ list vehicle ManagedEntities
→ explicit vehicle selection
→ service selection becomes available
```

and:

```text
WebChat
→ resolve Customer with no vehicle
→ create ManagedEntity
→ service selection becomes available
```

No physical claim is made by ME-G0 alone.
