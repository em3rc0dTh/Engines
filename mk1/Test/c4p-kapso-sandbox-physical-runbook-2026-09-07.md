# C4P Kapso Sandbox — physical runbook

Date: 2026-09-07
Branch: `build/mk1-c4p-kapso-official`

## 1. Use Sandbox first

In Kapso open WhatsApp → Sandbox / Sandbox WhatsApp → Add session. Register the WhatsApp phone number you will test from. Kapso provides a short activation code and a sandbox WhatsApp number. Open WhatsApp and send that code from the registered tester number until the session becomes active.

Do not use Kapso Workflows, Flows or Agent for this test.

## 2. Create a project API key

Kapso → Integrations → API keys. Create a project API key. Keep it local; never commit or paste it into evidence.

## 3. Run Engines

```bash
cd /mnt/c/Users/eduar/Desktop/VTKALL/Engines
git fetch origin --prune
git switch build/mk1-c4p-kapso-official
git pull
cd mk1/runtime

read -s -p "Kapso API key: " KAPSO_API_KEY; echo
export KAPSO_API_KEY
read -s -p "Webhook secret to configure in Kapso: " KAPSO_WEBHOOK_SECRET; echo
export KAPSO_WEBHOOK_SECRET
read -p "Kapso/Meta Phone Number ID: " KAPSO_PHONE_NUMBER_ID
export KAPSO_PHONE_NUMBER_ID
export KAPSO_GRAPH_API_VERSION=v24.0

docker compose down -v --remove-orphans
docker compose up --build -d postgres mongo temporal migrate worker
docker compose --profile kapso up --build -d whatsapp-kapso
curl -fsS http://localhost:8791/health
```

Expected health:

```json
{"ok":true,"provider":"KAPSO","agent":false,"mcp":false}
```

## 4. Public HTTPS callback

```bash
cloudflared tunnel --url http://localhost:8791
```

Take the temporary `https://*.trycloudflare.com` host and configure this webhook destination on the **Sandbox WhatsApp configuration**:

```text
https://<temporary-host>/webhooks/kapso
```

Webhook kind: Kapso/default.
Payload version: v2.
Event: `whatsapp.message.received`.
Secret key: exactly the local `KAPSO_WEBHOOK_SECRET` value.
Buffering: OFF for the first human proof.

## 5. Physical test

From the activated tester WhatsApp account send a normal message to the sandbox number. Expected first outbound response is the Engines consent UI.

Target flow:

```text
Hola
→ consent
→ Sí, registrarme
→ Temporal-required Customer fields
→ one intentionally invalid field
→ rejection + recovery on same Workflow
→ valid value
→ Registro completado
```

If Kapso supplies verified phone identity, Engines must not ask for phone again. If Kapso supplies BSUID only, Engines must not invent a phone and may ask for it because Customer policy requires it.

## 6. Evidence

Useful local observation without secrets:

```bash
docker compose logs -f whatsapp-kapso worker
```

Never publish API key, webhook secret, activation code, or account-specific identifiers.

## Claim boundary

Passing this runbook permits only:

`C4P KAPSO SANDBOX ✅ PHYSICALLY VERIFIED`

It does not seal a production WhatsApp business number or production readiness.
