# G3-I4 — Kapso Real Provider Human Certification Runbook

## Purpose

This runbook is the human/real-provider boundary for `G3-I4`.

Deterministic CI can prove adapter mapping, secret indirection, error taxonomy, webhook normalization, durable idempotency and predecessor regressions. It cannot prove that Kapso actually accepted a request under the owner's real account or that a webhook was really signed/delivered by Kapso.

Therefore G3-I4 MUST NOT be promoted to `CERTIFIED` until both real-provider proofs below are captured by the current Integration Engine adapter and ledgers.

## Safety and secret boundary

Never commit credential values or paste them into source files, receipts, PR comments, logs or Integration command/event payloads.

Use a local untracked environment file or export variables only in the local shell. Required secret values:

```text
KAPSO_API_KEY
KAPSO_WEBHOOK_SECRET
```

Non-secret runtime identifiers:

```text
KAPSO_PHONE_NUMBER_ID
KAPSO_TEST_RECIPIENT
KAPSO_TEST_BUSINESS_SLUG   optional; default i4-kapso-live
KAPSO_TEST_CONNECTION_REF optional; default kapso-live
```

The test recipient MUST be a number controlled/authorized by the tester. The outbound proof sends one real WhatsApp text.

## Preconditions

Checkout the current `build/g3-integration` head and start a clean local PostgreSQL lab.

```bash
git checkout build/g3-integration
git pull --ff-only origin build/g3-integration
cd mk1/runtime

docker compose down -v --remove-orphans
docker compose up -d postgres
```

Apply Integration migrations in sequence:

```bash
npx tsx scripts/migrate-postgres-integration-g3-i1.ts
npx tsx scripts/migrate-postgres-integration-g3-i2.ts
npx tsx scripts/migrate-postgres-integration-g3-i3.ts
```

Set the real provider values locally. Do not commit them:

```bash
export KAPSO_API_KEY='...'
export KAPSO_WEBHOOK_SECRET='...'
export KAPSO_PHONE_NUMBER_ID='...'
export KAPSO_TEST_RECIPIENT='+<authorized test number>'
```

---

# Preferred proof — one live session

The preferred harness proves outbound and inbound against the same registered Integration connection in one bounded session:

```text
IntegrationCommand
→ I1 registry
→ I2 outbound ledger
→ current Kapso Integration adapter
→ real Kapso API
→ real WhatsApp
→ human nonce reply
→ real signed Kapso v2 webhook
→ current Kapso Integration verifier
→ I3 inbound ledger
→ canonical IntegrationEvent
→ sanitized receipt
```

## 1. Expose the local listener

The harness listens by default on:

```text
http://localhost:8792
POST /webhooks/integration-g3-i4
GET  /health
```

Expose port `8792` through an HTTPS tunnel. For example, in a separate terminal:

```bash
cloudflared tunnel --url http://localhost:8792
```

Keep that tunnel running and copy its generated HTTPS base URL.

Set the complete public webhook URL including the Integration path:

```bash
export KAPSO_I4_PUBLIC_WEBHOOK_URL='https://<your-tunnel>/webhooks/integration-g3-i4'
```

## 2. Start the armed Integration harness

Run:

```bash
npm run probe:integration:g3:i4:live
```

The process starts the local listener first and prints:

```text
INTEGRATION_G3_I4_LIVE_LISTENER_READY
```

It then pauses before sending the outbound message. This pause is intentional: it removes the race between starting the local listener, registering the public endpoint and receiving the real provider callback.

## 3. Configure the Kapso number webhook while the listener is armed

Configure the same `KAPSO_PHONE_NUMBER_ID` with a **Kapso/event webhook** using:

```text
URL             $KAPSO_I4_PUBLIC_WEBHOOK_URL
Event           whatsapp.message.received
Payload         v2
Signing secret  same value as KAPSO_WEBHOOK_SECRET
Buffering       disabled for this bounded proof when configurable
```

Kapso's current webhook contract sends an HMAC-SHA256 hex signature in `X-Webhook-Signature`; the Integration verifier authenticates the exact raw body before canonical persistence.

Once the provider endpoint is configured, return to the harness terminal and press Enter.

For non-interactive automation only, the pause may be bypassed with:

```bash
export KAPSO_I4_AUTO_START=true
```

Use that only when the public webhook is already configured and reachable.

## 4. Complete the nonce-bound physical round trip

After Enter, the current Integration adapter performs one real outbound API request. The received WhatsApp message contains a one-time token similar to:

```text
I4-1A2B3C4D
```

Reply from the authorized WhatsApp recipient with **exactly that token**.

The harness accepts authenticated provider traffic, but only the matching nonce-bound text reply completes the physical proof. This prevents an unrelated valid webhook from being mistaken for the certification event.

Required terminal evidence:

```text
INTEGRATION_G3_I4_REAL_OUTBOUND_ACCEPTED
INTEGRATION_G3_I4_REAL_WEBHOOK_ACCEPTED
INTEGRATION_G3_I4_REAL_PROVIDER_PASS
```

The outbound marker requires a real provider message ID. The inbound marker is emitted only after HMAC verification, connection/capability resolution, canonical event construction and durable I3 dedup acceptance.

## 5. Sanitized receipt

On PASS, the harness writes by default:

```text
/tmp/engines-g3-i4-real-provider-receipt.json
```

Override only the destination if necessary:

```bash
export KAPSO_I4_RECEIPT_FILE='/tmp/engines-g3-i4-real-provider-receipt.json'
```

The generated receipt intentionally contains only promotion-safe evidence:

```text
git SHA
businessSlug
connectionRef
phoneNumberId
provider kind
outbound operation ID
provider outbound receipt ID
provider inbound event identity
canonical event ID/type
UTC timestamps
PASS markers
explicit truth-boundary flags
```

It does **not** contain:

```text
API key
webhook secret
recipient phone
raw webhook body
provider headers
message content / nonce reply
```

Do not commit a receipt unless it has been reviewed for this boundary.

## Optional live-session settings

```text
KAPSO_I4_WEBHOOK_HOST        default 0.0.0.0
KAPSO_I4_WEBHOOK_PORT        default 8792
KAPSO_I4_WEBHOOK_PATH        default /webhooks/integration-g3-i4
KAPSO_I4_WEBHOOK_TIMEOUT_MS  default 600000
KAPSO_I4_PUBLIC_WEBHOOK_URL  recommended public HTTPS endpoint
KAPSO_I4_RECEIPT_FILE        default /tmp/engines-g3-i4-real-provider-receipt.json
KAPSO_I4_AUTO_START          default false
```

---

# Fallback proof — split outbound and webhook capture

The earlier two-step harness remains available if the one-session listener cannot be used.

## A. Real outbound acceptance

Execute:

```bash
npx tsx scripts/certify-integration-g3-i4-real-outbound.ts
```

Required terminal evidence:

```text
INTEGRATION_G3_I4_REAL_OUTBOUND_ACCEPTED
```

A successful deterministic mock does not satisfy this proof. The adapter must execute the real HTTPS request against Kapso and receive a real provider message ID.

## B. Real signed webhook acceptance

Capture the **exact raw request body before JSON reserialization** and the signature header value supplied by Kapso.

Store the raw body in an untracked local file, for example:

```text
/tmp/kapso-real-webhook.json
```

Then set:

```bash
export KAPSO_REAL_WEBHOOK_BODY_FILE='/tmp/kapso-real-webhook.json'
export KAPSO_REAL_WEBHOOK_SIGNATURE='...'
```

Optional only if Kapso reports different metadata for the real delivery:

```bash
export KAPSO_REAL_WEBHOOK_EVENT='whatsapp.message.received'
export KAPSO_REAL_WEBHOOK_PAYLOAD_VERSION='v2'
```

Execute:

```bash
npx tsx scripts/certify-integration-g3-i4-real-webhook.ts
```

Required terminal evidence:

```text
INTEGRATION_G3_I4_REAL_WEBHOOK_ACCEPTED
```

The script authenticates the raw body before durable acceptance, normalizes it to canonical `IntegrationEvent`, persists through the I3 dedup ledger and proves the secret/signature are absent from the canonical durable event.

---

# Promotion rule

Only after both real markers are produced from the **current Integration implementation** and the same configured real Kapso connection may G3-I4 documentation and ledger be promoted:

```text
G3-I4 CERTIFIED
G3-I5 NEXT
```

Historical CTA/channel Kapso physical evidence is useful predecessor evidence, but it cannot be relabelled as G3-I4 certification because it did not execute the G3 Integration adapter/ledger boundary.

After the reviewed human receipt is committed:

```text
1. update g3-integration-engine-i4.md with the real-provider receipt;
2. promote the machine ledger I4 -> CERTIFIED and I5 -> NEXT;
3. rerun the dedicated G3-I4 gate on the documentation-complete exact head;
4. require all I4 jobs and predecessor regressions to pass on that exact head;
5. only then begin G3-I5 implementation.
```

Certification does not authorize merging PR #33. The PR remains draft/open until explicit owner authorization.
