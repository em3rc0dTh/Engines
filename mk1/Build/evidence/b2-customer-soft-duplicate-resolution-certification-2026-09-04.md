# B2 Customer soft-duplicate resolution — certification receipt

Date: 2026-09-04
Gate: `B2 CUSTOMER SOFT-DUPLICATE RESOLUTION`
Branch: `build/mk1-b2-customer-soft-duplicate-resolution`
Verdict: **✅ CERTIFIED**

## Runtime authority

```text
Certified source  36afff68af3237bd6431fd643d7d969e5452a296
Run               33899907141
Job               101111281727
Result            SUCCESS
Artifact          9947248334
Artifact name     mk1-b2-customer-soft-duplicate-33899907141
Artifact bytes    4769
SHA-256           2c02680d9e268957924303ab1113d71f0d872319b611a6ede3faca0a01ed678a
```

Later documentation commits do not replace the executed source above.

## Why B2 existed

The C2/C4 human local messaging test exposed a legitimate Customer Engine state:

```text
WAITING_FOR_DUPLICATE_DECISION
nextAction = RESOLVE_DUPLICATE
```

Telegram had already created a Customer. A later WhatsApp registration used a matching email, so the canonical Customer duplicate policy returned `SOFT_MATCH`. The channel correctly reached the real Temporal Workflow, but there was no deterministic domain Update to resolve that state. The previous simulator therefore failed closed rather than inventing duplicate policy.

B2 closes that shared Customer-domain gap. It does not move duplicate policy into Telegram or WhatsApp.

## Certified architecture path

```text
Telegram / WhatsApp presentation
        ↓
provider adapter
        ↓
CanonicalChannelEnvelope
        ↓
RESOLVE_CUSTOMER_DUPLICATE
        ↓
CustomerRegistrationChannelExecutionCore
        ↓
Temporal ResolveCustomerDuplicate Update
        ↓
existing RegisterNewCustomer Workflow
        ↓
PostgreSQL Customer authority + Mongo audit
```

## Runtime proof

### Cross-channel local E2E

The clean run first created a Customer through the Telegram-shaped local path, then started a WhatsApp-shaped registration using the same email while retaining a different verified synthetic WhatsApp sender phone.

Observed live Workflow state:

```text
Temporal: RUNNING / WAITING_FOR_DUPLICATE_DECISION / next=RESOLVE_DUPLICATE
knownFields   = customer.name, customer.contact.phone, customer.contact.email
missingFields = (none)
softMatchCandidates = 1
```

The simulator then rendered the deterministic human decision:

```text
1 Usar el registro existente
2 Crear un registro nuevo
```

Choosing `USE_EXISTING` completed the same Temporal Workflow as:

```text
Temporal: COMPLETED / ALREADY_EXISTS / next=NONE
```

The resulting Customer ID was exactly the Customer ID created by the Telegram seed. The WhatsApp sender phone remained prefilled and was never requested again.

### B2 golden domain probe

Direct markers:

```text
CUSTOMER_B2_INVALID_CANDIDATE_REJECTED_PASS
CUSTOMER_B2_DUPLICATE_DECISION_REPLAY_PASS
CUSTOMER_B2_USE_EXISTING_PASS
CUSTOMER_B2_CREATE_NEW_PASS
CUSTOMER_B2_SOFT_DUPLICATE_RESOLUTION_PASS
```

The final marker certified:

```json
{
  "useExisting": true,
  "createNew": true,
  "invalidCandidateRejected": true,
  "exactDecisionReplay": true,
  "agent": false,
  "mcp": false
}
```

Meaning:

- `USE_EXISTING` can resolve only to a Customer inside the current Workflow's `SOFT_MATCH` candidate set;
- an invalid candidate is rejected while the Workflow remains in duplicate-decision state;
- `CREATE_NEW` can explicitly continue the normal Customer creation path;
- hard-unique enforcement remains on the existing persistence path;
- an exact canonical duplicate-decision channel event replays from the durable channel ledger with no second business effect;
- duplicate policy remains transport-independent;
- no Agent/MCP is involved.

## Regression scope

The successful run also passed:

```text
TypeScript                                      PASS
Customer B1 contract suite                     26/26 PASS
C1B durable channel suite                       5/5 PASS
Telegram + WhatsApp adapter/render tests       13/13 PASS
clean Docker Compose infrastructure             PASS
Telegram local seed → Customer CREATED          PASS
WhatsApp soft match → ALREADY_EXISTS            PASS
```

## Failure / supersession provenance

### Full-probe run before the final authority

```text
Source   38d32ac415fb3853f2e091d21ad49683f1761705
Run      33899701530
Job      101110615612
Result   FAILURE
Stage    Full B2 domain golden probe
```

Cause: the certification probe reused the synthetic event identity `telegram:message:start` across multiple synthetic conversations. The already-certified durable channel ledger correctly rejected the second materially different event as `CHANNEL_EVENT_IDENTITY_CONFLICT`.

The fix scoped probe-only `externalMessageId` values by conversation. No Customer, Temporal, duplicate-policy, idempotency, or channel business invariant was relaxed. Source `36afff68af3237bd6431fd643d7d969e5452a296` is the sole full B2 runtime authority.

## Human evidence boundary

The earlier human run already proves:

```text
Telegram local registration                        ✅ HUMAN VERIFIED
Telegram invalid-phone rejection/recovery           ✅ HUMAN VERIFIED
WhatsApp sender-phone prefill                       ✅ HUMAN VERIFIED
WhatsApp no redundant phone prompt                  ✅ HUMAN VERIFIED
```

That human run discovered the B2 prerequisite before this implementation existed. Therefore the combined C2/C4 local E2E is **not yet claimed HUMAN VERIFIED** until the operator repeats the WhatsApp soft-match path on this B2 branch and observes `RESOLVE_DUPLICATE → ALREADY_EXISTS/CREATED → MESSAGING_LOCAL_E2E_PASS`.

See `mk1/Test/c2-c4-local-interactive-human-verification-2026-09-04.md`.

## Explicit non-claims

B2 does not certify:

- identity verification beyond the existing Customer duplicate policy;
- automatic contact merge/enrichment into an existing Customer;
- automatic adjudication when several soft-match candidates exist;
- real Telegram Bot API transport;
- real Meta WhatsApp Cloud API transport;
- Kapso runtime/provider behavior;
- public webhooks;
- Appointment or Scheduler over messaging;
- Agent, MCP or LLM routing;
- production readiness.

## Final bounded verdict

```text
B2 CUSTOMER SOFT-DUPLICATE RESOLUTION ✅ CERTIFIED
C2 Telegram local interactive E2E       ✅ HUMAN VERIFIED
C4 WhatsApp duplicate-resolution retest ⏳ HUMAN RETEST PENDING
```
