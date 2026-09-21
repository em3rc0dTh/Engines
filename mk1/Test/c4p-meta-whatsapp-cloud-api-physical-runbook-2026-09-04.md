# C4P Meta WhatsApp Cloud API — physical runbook

Date: 2026-09-04
Branch: `build/mk1-c4p-whatsapp-cloud-api-official`
Status: **READY FOR EDUARDO PHYSICAL TEST**

## Safety boundary

Never paste or commit these values:

```text
WHATSAPP_APP_SECRET
WHATSAPP_ACCESS_TOKEN
WHATSAPP_WEBHOOK_VERIFY_TOKEN
```

The test transcript/evidence must omit customer phone/email and all provider secrets.

## 1 — Checkout

```bash
cd /mnt/c/Users/eduar/Desktop/VTKALL/Engines
git fetch origin --prune
git switch --track origin/build/mk1-c4p-whatsapp-cloud-api-official
```

If the local branch already exists:

```bash
git switch build/mk1-c4p-whatsapp-cloud-api-official
git pull
```

Then:

```bash
cd mk1/runtime
```

## 2 — Obtain Meta test configuration

In the Meta app dashboard, use WhatsApp / Getting Started (or the equivalent current Cloud API setup panel) and identify:

```text
access token
phone number ID
Graph API version used by the current Meta setup
app secret (from the app's security/settings surface)
```

Use Meta's official test phone assets first if available. If the panel requires a recipient/test WhatsApp number, add the operator's WhatsApp number there.

The webhook verify token is chosen locally by the operator; it is not the Meta app secret.

## 3 — Load local environment without Git

```bash
read -s -p "Meta app secret: " WHATSAPP_APP_SECRET; echo
export WHATSAPP_APP_SECRET

read -s -p "WhatsApp access token: " WHATSAPP_ACCESS_TOKEN; echo
export WHATSAPP_ACCESS_TOKEN

read -p "WhatsApp Phone Number ID: " WHATSAPP_PHONE_NUMBER_ID
export WHATSAPP_PHONE_NUMBER_ID

read -p "Graph API version shown by Meta (for example vXX.0): " WHATSAPP_GRAPH_API_VERSION
export WHATSAPP_GRAPH_API_VERSION

read -s -p "Choose webhook verify token: " WHATSAPP_WEBHOOK_VERIFY_TOKEN; echo
export WHATSAPP_WEBHOOK_VERIFY_TOKEN
```

Do not run `echo` on the secret variables.

## 4 — Start Engines

```bash
docker compose down -v --remove-orphans

docker compose up --build -d postgres mongo temporal migrate worker

docker compose build whatsapp-cloud-api

docker compose --profile whatsapp up -d whatsapp-cloud-api

docker compose ps
```

Health check:

```bash
curl -fsS http://localhost:8790/health
```

Expected:

```json
{"ok":true,"provider":"META_CLOUD_API","agent":false,"mcp":false}
```

Inspect startup without printing secrets:

```bash
docker compose logs whatsapp-cloud-api
```

Expected marker:

```text
WHATSAPP_CLOUD_API_READY
```

## 5 — Expose localhost with temporary HTTPS

In a second terminal, with `cloudflared` installed:

```bash
cloudflared tunnel --url http://localhost:8790
```

Cloudflare will print an ephemeral URL similar to:

```text
https://<random>.trycloudflare.com
```

Keep this terminal running.

The Meta callback URL becomes:

```text
https://<random>.trycloudflare.com/webhooks/whatsapp
```

Quick Tunnel is test infrastructure only; do not treat the random URL as production hosting.

## 6 — Configure Meta webhook

In the Meta WhatsApp/Webhooks configuration surface:

```text
Callback URL:
https://<random>.trycloudflare.com/webhooks/whatsapp

Verify token:
<exact same local WHATSAPP_WEBHOOK_VERIFY_TOKEN>
```

Complete Meta's verification. Engines must return the challenge successfully.

Then subscribe the WhatsApp Business Account/app to message notifications using the current Meta configuration flow.

## 7 — Confirm provider path before Customer test

Keep a log terminal open:

```bash
docker compose logs -f whatsapp-cloud-api
```

No access token, app secret or verify token should appear in the log.

## 8 — Real WhatsApp test

From the real WhatsApp account authorized for the Meta test/business number, initiate a conversation with the Meta-provided WhatsApp number.

First physical expectation:

```text
customer sends any initial message
→ webhook reaches Engines
→ no Customer Workflow yet
→ Engines replies with consent

¿Nos autorizas a registrar tus datos para atenderte desde nuestro sistema?
[ Sí, registrarme ] [ Ahora no ]
```

Tap:

```text
Sí, registrarme
```

Expected Engine behavior:

```text
verified Meta sender identity
→ customer.contact.phone prefilled
→ phone is NOT requested again
→ ¿Cuál es tu nombre?
```

Supply a test name.

Then:

```text
¿Cuál es tu correo?
```

First send an invalid email such as:

```text
pepito
```

Expected:

```text
Ese dato no es válido. Inténtalo nuevamente.
¿Cuál es tu correo?
```

Then use a valid test email.

Expected terminal provider outcome in WhatsApp:

```text
✅ Registro completado.

Ya tenemos tus datos registrados.
```

## 9 — What must be captured

Capture only non-secret evidence:

```text
WHATSAPP_CLOUD_API_READY
Meta webhook verification succeeded
real inbound WhatsApp message observed
consent buttons observed
phone was not requested after provider prefill
invalid email rejected
same registration recovered
valid email completed registration
✅ Registro completado seen in real WhatsApp
```

Do not copy the actual access token, app secret, verify token, customer phone or private email into the public receipt.

## 10 — Current certification boundary

Before this physical run:

```text
C4P Meta WhatsApp Cloud API transport ✅ DETERMINISTIC PASS
real Meta provider                    ⚪ NOT YET CERTIFIED
```

After the complete real-provider observation and repository receipt:

```text
C4P META WHATSAPP CLOUD API ✅ PHYSICALLY VERIFIED / SEALED
```

## Troubleshooting boundary

If Meta verifies the webhook but no user messages arrive, inspect WABA/app webhook subscription and test-recipient configuration before changing Engines.

If inbound messages arrive but outbound Graph calls fail, inspect token validity, phone-number ID and current Graph API version before changing Customer/Temporal logic.

Do not bypass the official API with WhatsApp Web automation, QR-session scraping or browser emulation.
