# G3-I4 — Kapso Real Provider Human Certification Runbook

## Status

**G3-I4 PHYSICAL ROUND TRIP COMPLETED AND PROMOTED TO CERTIFIED.**

This runbook remains as the reproducible human/real-provider procedure and truth-boundary reference for future re-validation. The canonical certification receipt is:

```text
mk1/Test/g3-integration-engine-i4.md
```

Repository-safe physical evidence is recorded at:

```text
mk1/Build/evidence/integration-g3-i4-certification-2026-09-17.md
```

## Purpose

Deterministic CI proves adapter mapping, secret indirection, error taxonomy, webhook normalization, durable idempotency and predecessor regressions. The physical procedure proves that Kapso actually accepts an outbound request under the owner's real account and that a signed inbound webhook can traverse the current G3 Integration adapter and I3 ledger.

## Safety and secret boundary

Never commit credential values or paste them into source files, receipts, PR comments, logs or Integration command/event payloads.

Required owner-held secret values:

```text
KAPSO_API_KEY
KAPSO_WEBHOOK_SECRET
```

Non-secret runtime identifiers:

```text
KAPSO_PHONE_NUMBER_ID
KAPSO_TEST_RECIPIENT
KAPSO_TEST_BUSINESS_SLUG   optional; default i4-kapso-live
KAPSO_TEST_CONNECTION_REF optional; use a fresh value for each physical run
```

The test recipient MUST be a number controlled/authorized by the tester. The proof sends one real WhatsApp text.

## Preconditions

Checkout the current `build/g3-integration` head and start a clean local PostgreSQL lab.

```bash
git checkout build/g3-integration
git pull --ff-only origin build/g3-integration
cd mk1/runtime

docker compose down -v --remove-orphans
docker compose up -d postgres
```

On Windows, the Compose PostgreSQL port is bound only to `127.0.0.1:5432` so local PowerShell/Node can reach it without exposing PostgreSQL externally.

Apply Integration migrations in sequence:

```bash
npx tsx scripts/migrate-postgres-integration-g3-i1.ts
npx tsx scripts/migrate-postgres-integration-g3-i2.ts
npx tsx scripts/migrate-postgres-integration-g3-i3.ts
```

Set real provider values locally. Do not commit them.

Bash:

```bash
export KAPSO_API_KEY='...'
export KAPSO_WEBHOOK_SECRET='...'
export KAPSO_PHONE_NUMBER_ID='...'
export KAPSO_TEST_RECIPIENT='+<authorized test number>'
export KAPSO_TEST_CONNECTION_REF="kapso-live-$(date +%s)"
```

PowerShell:

```powershell
$env:KAPSO_API_KEY='...'
$env:KAPSO_WEBHOOK_SECRET='...'
$env:KAPSO_PHONE_NUMBER_ID='...'
$env:KAPSO_TEST_RECIPIENT='+<authorized test number>'
$env:KAPSO_TEST_CONNECTION_REF = "kapso-live-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
$env:KAPSO_I4_RECEIPT_FILE = Join-Path $env:TEMP 'engines-g3-i4-real-provider-receipt.json'
```

A fresh `KAPSO_TEST_CONNECTION_REF` is required for repeat physical attempts so immutable registry material from a previous run cannot create a false `CONNECTION_CONFLICT`.

## Provider preflight

Before arming the physical harness, validate that the Kapso project key can read the configured phone-number resource. Do not print the key itself.

PowerShell example:

```powershell
$kapsoCheck = "https://api.kapso.ai/meta/whatsapp/v24.0/$($env:KAPSO_PHONE_NUMBER_ID)"
curl.exe -sS -o NUL -w "%{http_code}`n" `
  -H "X-API-Key: $($env:KAPSO_API_KEY)" `
  $kapsoCheck
```

Expected result:

```text
200
```

A 401/403 means the real provider authentication boundary is not ready and the certification harness must not be used to claim I4.

## WhatsApp 24-hour service window

A free-form text message can be rejected by the provider when the customer-service window is closed. During the 2026-09-17 physical certification, a direct preflight returned HTTP 422 with a provider instruction to use a template outside the 24-hour window.

For this bounded human proof, the authorized recipient opened the service window by sending an inbound message to the business number before the harness sent its nonce-bound free-form text. This is a provider operating condition, not a change in G3 authority.

## Preferred proof — one live session

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

### 1. Expose the local listener

The harness listens by default on:

```text
http://localhost:8792
POST /webhooks/integration-g3-i4
GET  /health
```

Expose port `8792` through an HTTPS tunnel, for example:

```bash
cloudflared tunnel --url http://localhost:8792
```

Keep the tunnel running and set the complete public webhook URL.

Bash:

```bash
export KAPSO_I4_PUBLIC_WEBHOOK_URL='https://<your-tunnel>/webhooks/integration-g3-i4'
```

PowerShell:

```powershell
$env:KAPSO_I4_PUBLIC_WEBHOOK_URL='https://<your-tunnel>/webhooks/integration-g3-i4'
```

Verify public reachability:

```text
GET https://<your-tunnel>/health
→ {"ok":true,"gate":"G3-I4","provider":"KAPSO"}
```

### 2. Start the armed Integration harness

```bash
npm run probe:integration:g3:i4:live
```

The process starts the local listener first and prints:

```text
INTEGRATION_G3_I4_LIVE_LISTENER_READY
```

It then pauses before the outbound send.

### 3. Configure the Kapso webhook while the listener is armed

Configure the same `KAPSO_PHONE_NUMBER_ID` with:

```text
URL             $KAPSO_I4_PUBLIC_WEBHOOK_URL
Event           whatsapp.message.received
Payload         v2
Signing secret  same value as KAPSO_WEBHOOK_SECRET
Buffering       disabled for this bounded proof when configurable
```

Once the provider endpoint is configured, return to the harness terminal and press Enter.

### 4. Complete the nonce-bound physical round trip

The harness prints a one-time token similar to:

```text
I4-1A2B3C4D
```

Reply from the authorized WhatsApp recipient with exactly that token.

Required terminal evidence:

```text
INTEGRATION_G3_I4_REAL_OUTBOUND_ACCEPTED
INTEGRATION_G3_I4_REAL_WEBHOOK_ACCEPTED
INTEGRATION_G3_I4_REAL_PROVIDER_PASS
```

Only the nonce-bound signed inbound message completes the proof.

### 5. Sanitized receipt

On PASS, the harness writes the receipt to `KAPSO_I4_RECEIPT_FILE` or its platform default.

The receipt contains promotion-safe evidence such as source SHA, business/connection reference, operation/event identity, timestamps and PASS markers. It must not contain raw credentials, recipient phone, raw webhook body, provider headers or message content.

## Certified physical session — 2026-09-17

The successful session ran on:

```text
source SHA  25ec2f0dd53c3eb2e56f6230d1d0402e8e3a0c22
result      PASS
replayed    false
```

Observed markers:

```text
INTEGRATION_G3_I4_REAL_OUTBOUND_ACCEPTED
INTEGRATION_G3_I4_REAL_WEBHOOK_ACCEPTED
INTEGRATION_G3_I4_REAL_PROVIDER_PASS
```

The exact provider IDs and external phone-number identifier are intentionally not duplicated in this public runbook. Repository-safe fingerprints are retained in the canonical I4 evidence file.

## Promotion rule

The 2026-09-17 physical proof satisfied the real-provider boundary. The sequential state is therefore:

```text
G3-I4 CERTIFIED
G3-I5 NEXT
```

Certification is sealed only when the documentation-complete exact-head workflow also passes and emits:

```text
INTEGRATION_G3_I4_CERTIFICATION_PASS
```

Certification does not authorize merging PR #33. The PR remains draft/open until explicit owner authorization.
