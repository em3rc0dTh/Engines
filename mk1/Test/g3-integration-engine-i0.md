# G3-I0 — Integration canonical contracts + authority boundary

## Status

**✅ CERTIFIED — provider-neutral Integration command/event boundary established. G3-I1 is NEXT.**

## Scope

G3-I0 introduces only the provider-neutral Integration boundary:

```text
Temporal/domain
  → IntegrationCommand
  → Integration boundary

provider-authenticated/normalized input
  → IntegrationEvent
  → Temporal/domain
```

Executable surface:

```text
mk1/runtime/src/contracts/integration-engine/types.ts
mk1/runtime/src/contracts/integration-engine/validation.ts
mk1/runtime/src/contracts/integration-engine/index.ts
mk1/runtime/src/contracts/integration-engine/integration-engine.contract.test.ts
mk1/runtime/scripts/certify-integration-g3-i0.ts
mk1/runtime/scripts/verify-integration-certification-ledger.ts
```

## Certified proof

The dedicated gate proves:

```text
provider-neutral command/event validation
exact canonical top-level fields
business-scoped stable outbound operation identity
business+connection-scoped stable provider-event identity
exactly one subjectRef/targetRef per command
secret-like material rejected recursively
provider HTTP/SDK mechanics rejected from canonical payloads
Integration contracts remain decoupled from Scheduler/Services/CTA/Temporal implementation modules
protected Scheduler/Services/Appointment/CTA/channel regressions remain green
```

Candidate exact head:

```text
7a8cef71463217515c0d017dfaa5766ce7fe6f33
```

Candidate dedicated runs:

```text
Push  35133232783  SUCCESS
PR    35133238680  SUCCESS
```

Candidate artifacts and digests are preserved in:

```text
mk1/Build/evidence/integration-g3-i0-certification-2026-09-16.md
```

The first candidate was rejected by TypeScript with `TS2456` on recursive canonical JSON aliases. The contract was repaired with a readonly recursive `JsonObject` interface; no proof condition was weakened.

## Truth boundary

G3-I0 does not provide connection persistence, secret storage, external delivery, retry persistence, HTTP webhook ingress, webhook authentication, dedup persistence, a real provider adapter or Temporal Integration composition.

Existing Telegram and WhatsApp/Kapso interactive transports remain CTA/channel evidence; they are not Integration certification.

## Terminal marker

The dedicated workflow emits:

```text
INTEGRATION_G3_I0_CERTIFICATION_PASS
```

## Sequential next state

```text
G3-I0  CERTIFIED
G3-I1  NEXT
G3-I2  OPEN
G3-I3  OPEN
G3-I4  OPEN
G3-I5  OPEN
```

The documentation-complete exact branch head must re-run this same G3-I0 workflow successfully for both push and PR before the certification head is considered sealed. Final run IDs/digests are recorded on PR #33 without moving that sealed head.
