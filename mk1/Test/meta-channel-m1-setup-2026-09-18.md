# Meta channel M1 physical runbook

Date: 2026-09-18

## Reusable setup

1. Use a clean Business Portfolio and a Facebook Page controlled by that portfolio.
2. In Meta for Developers create a dedicated app for the Messenger use case.
3. Do not repurpose unrelated WhatsApp/Kapso apps.
4. During development, use administrator/developer/tester accounts for physical testing.
5. Connect the Page under Messenger API settings.
6. Store the Page Access Token as a runtime secret.
7. Deploy an always-on HTTPS callback.
8. Register a callback shaped like:
   `https://<worker>.<workers-subdomain>.workers.dev/webhooks/meta/messenger`
9. Store the verification token as `META_WEBHOOK_VERIFY_TOKEN`.
10. Verify and save the callback.
11. Explicitly subscribe the Page to `messages` and `messaging_postbacks`.
12. Send a physical message from an allowed personal profile to the Page.
13. Confirm the callback receives a POST with `object=page`, sender id, Page id, message id, and text.
14. Test a Page Send API reply inside the permitted response window.
15. Before production, validate `X-Hub-Signature-256` using `META_APP_SECRET` and complete the required App Review/access process.

## Why the URL matters

A quick development tunnel tied to a laptop is unsuitable as the registered callback because the endpoint disappears when the local process stops. A Worker URL remains available independently of the laptop.

The repository intentionally stores the URL pattern, not a developer-specific host. Environment-owned deployment coordinates belong in runtime configuration/ops evidence.

## Problems encountered during the physical setup

- A legacy Business Portfolio had an advertising restriction; a clean portfolio was used instead.
- The administrator Facebook account itself was not restricted.
- Existing developer apps belonged to the WhatsApp/Kapso experiment and were left untouched.
- App creation from Business Settings stalled on a waiting screen; creating the dedicated app in Meta for Developers succeeded.
- Connecting the Page did not automatically subscribe webhook fields; `messages` and `messaging_postbacks` had to be selected explicitly.
- Facebook displayed a personal profile and a Page profile; this is expected Page switching, not two personal accounts.
- A laptop-dependent quick tunnel was rejected as the durable callback architecture.
- A short-lived hosted trial was also rejected for the durable callback requirement.
- App Review was deliberately deferred until after internal role-based physical testing worked.

## Physical markers used

Inbound:

```text
TEST-ENGINES-001
```

Outbound request:

```text
TEST-OUTBOUND-001
```

Observed reply:

```text
Engines received: "TEST-OUTBOUND-001" ✅
```

## Non-claims

This runbook does not claim public production approval, deployed signature enforcement, or physical CTA -> Temporal -> persistence completion.
