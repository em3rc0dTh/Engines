# ME1 — Managed Entity Resolution Test Plan

Date: 2026-09-09  
Updated: 2026-09-10

## Current implemented scope

ME1 now covers both prerequisites of the business intent:

```text
Customer Resolution
→ Managed Entity Resolution
→ Service / Offering / Appointment
```

The implementation remains deterministic and explicitly excludes Agent/MCP/LLM behavior.

## Customer-resolution assertions

For a fresh channel with no trusted identity:

```text
name + exactly 1 active normalized match
→ EXISTING Customer
→ no email/phone collection required

name + 0 matches
→ Customer remains unresolved
→ request stronger identity (WebChat: email)

name + >1 matches
→ AMBIGUOUS
→ request stronger identity (WebChat: email)

name + email + existing email match
→ strong identity wins
→ EXISTING Customer

name + email + no strong match
→ do not fall back to same-name Customer
→ if registration minimum is complete, create Customer
```

Email is strong identifying material but is not declared globally unique by the current schema; zero/one/multiple matches remain valid deterministic outcomes.

A trusted identity already supplied by a provider/session is allowed to bypass name discovery. Example: verified WhatsApp phone or trusted explicit `customerId`.

## ManagedEntity policy assertions

```text
Gallo + 0 vehicles       → CREATE_NEW
Gallo + 1 vehicle        → SELECT explicitly
Gallo + N vehicles       → SELECT compatible candidates
Gallo + wrong type only  → CREATE_NEW
BateYLate + old requests → CREATE_NEW_DEFAULT
```

## Persistence assertions

```text
create ManagedEntity with stable externalRef
→ CREATED

same owner/type/ref + same material
→ EXISTING
→ same managedEntityId

same owner/type/ref + different material
→ CONFLICT
→ no silent overwrite

foreign Customer tries to select another Customer's ManagedEntity
→ NOT FOUND / rejected
```

## Why explicit selection for one durable subject

The workflow must establish the subject intentionally. `AUTO_IF_SINGLE` remains available as a policy option, but Gallo's initial fixture uses `ALWAYS_EXPLICIT` so the CTA asks/affirms which vehicle receives the work.

## Why create-new default for BateYLate

A prior dessert request is historical context, not necessarily the subject of today's custom order. Reusing it must be an explicit repeat/clone intent, not an accidental default.

## CI proof

The ME1 workflow must execute:

```text
TypeScript
appointment contract tests
WebChat/channel regression
clean PostgreSQL + Mongo + Temporal stack
customer name-discovery persistence proof
ManagedEntity persistence/idempotency/ownership proof
```

A green deterministic CI run is necessary but does not replace the physical browser gate.

## Physical WebChat proof

Case A — existing Customer by name:

```text
Start Appointment
→ ask name
→ enter an existing unique Customer name
→ Temporal resolves EXISTING
→ no email/phone prompt
→ ManagedEntity selection/creation
```

Case B — unknown Customer:

```text
Start Appointment
→ ask name
→ enter unknown name
→ Temporal returns unresolved/incomplete
→ WebChat asks email
→ enter email
→ Temporal strong-identity lookup
→ existing Customer OR deterministic Customer creation
→ ManagedEntity resolution
```

Case C — duplicate name:

```text
Start Appointment
→ ask name shared by multiple Customers
→ Temporal returns AMBIGUOUS
→ WebChat asks email
→ strong identity disambiguates or creates safely
```

Then Gallo ManagedEntity proof:

```text
existing Customer + 2 vehicles
→ explicit vehicle choice
→ Car Wash
→ Appointment
→ Appointment / Case / Reservation reference the same selected vehicle
```

and:

```text
existing/new Customer + 0 vehicles
→ create ManagedEntity
→ service selection becomes available
→ Appointment references the created ManagedEntity
```

No physical certification claim is made until these browser cases are executed against the candidate SHA.
