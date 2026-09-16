# Platform Steps 3–5 Roadmap — Integration G3 Active Track

Integration remains separate from core scheduling and interactive CTA/channel ingress.

Canonical track:

```text
ACTIVE BRANCH  build/g3-integration
ACTIVE PR      #33 — Integration G3 canonical track
BASE           feature/pre-scheduler-node-edge-certification @ Scheduler merge 3b1d43d87ef7bb9805e01bcaaf8260008327b1f1
```

Sequential gate state:

```text
G3-I0 canonical command/event contracts + authority boundary   ✅ CERTIFIED
G3-I1 connection/provider registry + secret references         ✅ CERTIFIED
G3-I2 durable outbound command + retry/idempotency ledger       ✅ CERTIFIED
G3-I3 authenticated inbound webhook + deduplication ledger      ✅ CERTIFIED
G3-I4 first real provider adapter — Kapso WhatsApp              🟡 HUMAN TEST READY / NEXT
G3-I5 Temporal composition + failure/recovery certification     🔒 LOCKED UNTIL I4 CERTIFIED
```

## G3-I0 — CERTIFIED

G3-I0 freezes the provider-neutral executable contracts:

```text
Temporal/domain
  → IntegrationCommand
  → Integration Engine boundary

provider-authenticated/normalized input
  → IntegrationEvent
  → Temporal/domain
```

Certified invariants include:

```text
exact canonical top-level command/event shape
stable business-scoped operation identity
stable business + connection scoped provider-event identity
exactly one subjectRef or targetRef on an IntegrationCommand
recursive secret-like material rejection from canonical payloads
provider HTTP/SDK mechanics rejected from canonical payloads
Integration canonical contracts do not couple to Scheduler/Services/CTA/Temporal implementations
protected predecessor regressions remain green
```

## G3-I1 — CERTIFIED

I1 materializes the durable business-scoped provider/connection registry while keeping raw credentials outside PostgreSQL.

Certified boundary:

```text
IntegrationProviderDefinition
IntegrationConnection
IntegrationSecretReference
provider capability validation
connection enable/disable state
optimistic revision control
ENV / external-secret-store references only
raw secret values excluded from registry rows
```

## G3-I2 — CERTIFIED

I2 owns durable provider-neutral outbound execution state:

```text
IntegrationCommand
→ durable enqueue
→ business + operation idempotency
→ delivery claim / lease
→ bounded attempts
→ retry scheduling
→ lease-expiry recovery
→ terminal success/permanent failure
→ provider receipt reference
```

I2 does not own provider HTTP mechanics; those are supplied by an I4 adapter.

## G3-I3 — CERTIFIED

I3 owns authenticated inbound acceptance after a provider verifier succeeds:

```text
transient raw webhook + headers
→ provider authentication / verification
→ connection + capability resolution
→ canonical IntegrationEvent
→ durable provider-event deduplication
→ replay-safe acceptance
```

Raw signed request material and secrets are not durable canonical event state.

## G3-I4 — HUMAN TEST READY / NEXT

The first concrete Integration provider is Kapso WhatsApp.

Implemented and deterministically green:

```text
SecretRef → runtime-only API key / webhook secret resolution
canonical messaging.send/send_text → Kapso HTTPS request mapping
real-provider HTTP error → canonical Integration error mapping
provider message ID → providerReceiptRef
Kapso HMAC-SHA256 raw-body verification
Kapso v2 message normalization
phone-number-ID scope enforcement
invalid signature → zero durable canonical event
real-provider harness without credential persistence
single-session live harness with nonce-bound reply
sanitized receipt generation
protected Scheduler/Services/Appointment/CTA/channel regressions
```

Deterministic readiness marker:

```text
INTEGRATION_G3_I4_HUMAN_TEST_READY
```

This marker is intentionally **not** certification.

The remaining real-provider evidence must be produced by the current G3 Integration implementation:

```text
INTEGRATION_G3_I4_REAL_OUTBOUND_ACCEPTED
INTEGRATION_G3_I4_REAL_WEBHOOK_ACCEPTED
INTEGRATION_G3_I4_REAL_PROVIDER_PASS
```

Preferred execution:

```text
cd mk1/runtime
npm run probe:integration:g3:i4:live
```

That bounded session proves:

```text
current IntegrationCommand
→ I1 connection registry
→ I2 durable outbound ledger
→ current Kapso Integration adapter
→ real Kapso API
→ real WhatsApp receipt
→ nonce-bound human reply
→ real signed Kapso webhook
→ current Kapso Integration verifier
→ I3 inbound dedup ledger
→ canonical IntegrationEvent
→ sanitized receipt
```

Historical Kapso CTA/channel physical evidence remains valid predecessor evidence, but it cannot be relabelled as G3-I4 certification because it did not execute this G3 Integration adapter/ledger boundary.

Promotion remains:

```text
real provider round trip PASS
→ review sanitized receipt
→ write I4 certification receipt
→ machine ledger: I4 CERTIFIED / I5 NEXT
→ rerun dedicated I4 gate on documentation-complete exact head
→ only then unlock I5
```

## G3-I5 — LOCKED

I5 may compose Integration through Temporal only after I4 reaches `CERTIFIED` under the sequential hard-gate policy.

Intended I5 scope remains:

```text
Temporal activity/workflow composition around IntegrationCommand delivery
retry/failure ownership proof without duplicating I2 retry authority
workflow recovery/replay behavior
inbound IntegrationEvent orchestration handoff
exact-head failure/recovery certification
```

I5 must not begin early merely because deterministic I4 readiness is green.

## Cross-track dependency rules

```text
Channel work must not wait for Scheduler.
Scheduler consumes frozen Services snapshots/demands, not channels.
Integration is not a prerequisite for core scheduling.
Appointment migration is complete at G2-S7.
Persistence ownership stays explicit across PostgreSQL / MongoDB / Object Store.
Agent/MCP waits until deterministic core gates are sufficiently mature.
Scheduler G2 is frozen after terminal certification/merge except for explicitly scoped fixes/regressions.
Integration gates advance sequentially under their own G3 ledger/policy.
```

## Frozen authority boundaries

```text
Services = commercial/catalog + abstract scheduling semantics
Scheduler = concrete time/resource allocation
Integration = external-system adapter/delivery mechanics
Channel interactive ingress = CTA, not Integration
PostgreSQL = transactional operational truth
Temporal = orchestration authority
MongoDB = operational document/audit/semantic evidence
Object Store = attachment bytes/content integrity
```

## Next executable work

```text
1. Require the documentation-complete current G3-I4 readiness workflow to remain green.
2. Run the preferred single-session real Kapso harness locally with owner-held credentials.
3. Require a real Kapso outbound message ID from the current Integration adapter.
4. Require a real signed Kapso v2 inbound message through the current I3 ledger.
5. Preserve only the generated sanitized receipt; never commit secrets/raw provider payloads.
6. Promote I4 only after both real markers are present from the same configured connection.
7. Re-run G3-I4 on the promoted documentation-complete exact head.
8. Only after that exact-head seal may G3-I5 implementation begin.
9. Keep PR #33 draft/unmerged; certification does not authorize merge.
```
