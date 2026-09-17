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
G3-I4 first real provider adapter — Kapso WhatsApp              ✅ CERTIFIED
G3-I5 Temporal composition + failure/recovery certification     🟡 NEXT
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

## G3-I4 — CERTIFIED

The first concrete Integration provider is Kapso WhatsApp.

Deterministic surfaces certified:

```text
SecretRef → runtime-only API key / webhook secret resolution
canonical messaging.send/send_text → Kapso HTTPS request mapping
provider HTTP outcome → canonical Integration outcome mapping
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

Physical source head:

```text
25ec2f0dd53c3eb2e56f6230d1d0402e8e3a0c22
```

Observed real-provider markers:

```text
INTEGRATION_G3_I4_REAL_OUTBOUND_ACCEPTED
INTEGRATION_G3_I4_REAL_WEBHOOK_ACCEPTED
INTEGRATION_G3_I4_REAL_PROVIDER_PASS
```

The physical session proved:

```text
current IntegrationCommand
→ I1 connection registry
→ I2 durable outbound ledger
→ current Kapso Integration adapter
→ real Kapso API
→ real WhatsApp delivery
→ nonce-bound human reply
→ real signed Kapso webhook
→ current Kapso Integration verifier
→ I3 inbound dedup ledger
→ canonical IntegrationEvent
→ repository-safe sanitized certification receipt
```

The first direct provider preflight correctly exposed a closed WhatsApp 24-hour customer-service window as HTTP 422. After the authorized recipient opened that service window with an inbound message, the current G3 Integration path completed the outbound and signed inbound round trip successfully.

This does not grant I4 ownership over WhatsApp conversation-policy orchestration. It certifies the provider adapter and real signed round-trip boundary only.

Certification receipt:

```text
mk1/Test/g3-integration-engine-i4.md
```

Repository-safe physical evidence:

```text
mk1/Build/evidence/integration-g3-i4-certification-2026-09-17.md
```

Historical CTA/channel Kapso evidence remains predecessor evidence only; G3-I4 certification is based on the current G3 Integration adapter/ledger path.

## G3-I5 — NEXT

I5 is now unlocked by sequential promotion and is the only next G3 gate.

Intended I5 scope:

```text
Temporal activity/workflow composition around IntegrationCommand delivery
retry/failure ownership proof without duplicating I2 retry authority
workflow recovery/replay behavior
inbound IntegrationEvent orchestration handoff
exact-head failure/recovery certification
```

I5 must preserve these authority boundaries:

```text
I2 owns durable provider delivery attempts, retry schedule and lease recovery
Temporal owns orchestration/replay and business-process progression
I5 must not create a second provider retry authority inside Temporal
I3 remains the durable authenticated inbound acceptance boundary
provider secrets/raw webhook material remain outside workflow history and canonical payloads
```

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
1. Seal G3-I4 on the documentation-complete exact branch head.
2. Require the I4 workflow to re-certify deterministic I0-I4 boundaries and protected regressions.
3. Require the committed I4 receipt + physical-evidence projection to pass truth-boundary checks.
4. Require the I4 workflow to emit INTEGRATION_G3_I4_CERTIFICATION_PASS.
5. Only after that exact-head seal, begin G3-I5 implementation.
6. Build Temporal composition without duplicating I2 retry authority.
7. Certify workflow replay/recovery and inbound IntegrationEvent handoff.
8. Keep PR #33 draft/unmerged; certification does not authorize merge.
```
