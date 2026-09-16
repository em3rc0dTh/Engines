# G3 Integration Engine — Sequential Hard-Gate Certification Policy

## Purpose

Integration Engine follows the same evidence discipline used to close Scheduler G2: one canonical build branch, sequential hard gates, explicit receipts, machine-readable state, exact-head re-runs, and no silent claim expansion.

## Canonical track

```text
branch: build/g3-integration
track:  G3 Integration Engine
base:   post-Scheduler-G2 merged baseline
```

## Gate sequence

```text
G3-I0  canonical command/event contracts + authority boundary
G3-I1  connection/provider registry + secret references
G3-I2  durable outbound command + retry/idempotency ledger
G3-I3  authenticated inbound webhook + deduplication ledger
G3-I4  first real provider adapter
G3-I5  Temporal composition + failure/recovery certification
```

## Mandatory rule

Every gate must execute this sequence before the next gate begins:

```text
IMPLEMENT / FORMALIZE
→ RUN DEDICATED GATE CI
→ PROVE PROTECTED PREDECESSOR REGRESSIONS
→ EMIT GATE-SPECIFIC TERMINAL MARKER
→ PRESERVE EVIDENCE ARTIFACT
→ WRITE/UPDATE TEST RECEIPT + TRUTH BOUNDARY
→ UPDATE MACHINE-READABLE LEDGER
→ RE-RUN SAME GATE ON FINAL BRANCH HEAD
→ ONLY THEN ADVANCE
```

Documentation changes after a successful code run move the head and therefore require the same gate to be re-run on the new exact head before certification is claimed.

## Authority rules

Integration core may own:

```text
connection identity
provider registry metadata
secret references
provider-neutral commands/events
outbound delivery state
retry/idempotency mechanics
webhook verification boundary
inbound replay/dedup mechanics
provider adapters
```

Integration core must not own:

```text
commercial catalog semantics
Scheduler capacity/allocation
Appointment workflow decisions
customer identity authority
interactive channel conversation routing
Temporal orchestration authority
raw secret values in canonical payloads/evidence
```

## Existing channel transports

Existing Telegram and WhatsApp/Kapso interactive transports remain CTA/channel certification evidence. G3 must not relabel them as Integration Engine certification without a dedicated Integration gate proving that boundary.

## Merge boundary

Certification never authorizes merge by itself. Any Integration PR remains unmerged until explicit owner authorization.
