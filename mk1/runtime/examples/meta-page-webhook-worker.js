const MESSENGER_PATH = "/webhooks/meta/messenger";
const COMMENTS_PATH = "/webhooks/meta/facebook-comments";
const PRIVACY_PATH = "/privacy";
const TERMS_PATH = "/terms";
const DATA_DELETION_PATH = "/data-deletion";
const GRAPH_API_VERSION = "v26.0";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === PRIVACY_PATH) {
      return legalPage(
        env,
        "Privacy Policy",
        `<p>This proof-of-concept may process Page identifiers, post/comment identifiers, sender identifiers, messages, comments, and webhook metadata for integration testing, appointment workflow routing, troubleshooting, and validation.</p>
         <p>Personal data is not sold. Public comments are treated only as workflow triggers; sensitive appointment information should not be requested in public comments.</p>
         <p>For deletion instructions see <a href="${DATA_DELETION_PATH}">User Data Deletion</a>.</p>`
      );
    }

    if (request.method === "GET" && url.pathname === TERMS_PATH) {
      return legalPage(
        env,
        "Terms of Service",
        `<p>This service is experimental software intended for development, integration testing, and proof-of-concept validation.</p>
         <p>It may change, be interrupted, or be discontinued while development is in progress.</p>
         <p>Users must not submit information they are not authorized to provide or use the service unlawfully.</p>`
      );
    }

    if (request.method === "GET" && url.pathname === DATA_DELETION_PATH) {
      return legalPage(
        env,
        "User Data Deletion",
        `<p>To request deletion of data associated with this proof-of-concept, contact the address below with the subject <strong>Engines Channels PoC — Data Deletion Request</strong>.</p>
         <p>Include enough information to identify the interaction. Do not send passwords, access tokens, or application secrets.</p>`
      );
    }

    if (url.pathname !== MESSENGER_PATH && url.pathname !== COMMENTS_PATH) {
      return new Response("Not Found", { status: 404 });
    }

    if (request.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      if (mode === "subscribe" && token === env.META_WEBHOOK_VERIFY_TOKEN && challenge) {
        return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
      }
      return new Response("Forbidden", { status: 403 });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, POST" } });
    }

    if (!env.META_APP_SECRET) {
      console.error("META_HMAC_CONFIGURATION_ERROR");
      return new Response("Server Misconfigured", { status: 500 });
    }

    const rawBody = await request.arrayBuffer();
    const signature = request.headers.get("x-hub-signature-256");
    if (!signature) {
      console.warn("META_HMAC_MISSING", JSON.stringify({ path: url.pathname }));
      return new Response("Unauthorized", { status: 401 });
    }
    if (!(await verifyMetaSignature(rawBody, signature, env.META_APP_SECRET))) {
      console.warn("META_HMAC_INVALID", JSON.stringify({ path: url.pathname }));
      return new Response("Forbidden", { status: 403 });
    }

    console.log("META_HMAC_VALID", JSON.stringify({ path: url.pathname }));

    let payload;
    try {
      payload = JSON.parse(new TextDecoder().decode(rawBody));
    } catch {
      return new Response("Bad Request", { status: 400 });
    }

    console.log("META_PAYLOAD", JSON.stringify(payload));

    let hasFeedChange = false;
    for (const entry of Array.isArray(payload?.entry) ? payload.entry : []) {
      for (const messagingEvent of Array.isArray(entry?.messaging) ? entry.messaging : []) {
        console.log("MESSENGER_EVENT", JSON.stringify(messagingEvent));
        const senderId = messagingEvent?.sender?.id;
        const pageId = messagingEvent?.recipient?.id;
        const messageText = messagingEvent?.message?.text;
        const postbackPayload = messagingEvent?.postback?.payload;

        if (senderId && pageId && postbackPayload) {
          console.log("MESSENGER_POSTBACK", JSON.stringify({ senderId, pageId, payload: postbackPayload }));
          continue;
        }

        if (!senderId || !pageId || !messageText) continue;
        console.log("MESSENGER_MESSAGE", JSON.stringify({ senderId, pageId, text: messageText }));

        if (!env.META_PAGE_ACCESS_TOKEN) {
          console.error("META_PAGE_ACCESS_TOKEN_MISSING");
          continue;
        }

        const metaResponse = await fetch(
          `https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.META_PAGE_ACCESS_TOKEN}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              recipient: { id: senderId },
              message_type: "RESPONSE",
              message: { text: `Engines received: "${messageText}" ✅` }
            })
          }
        );

        console.log("META_SEND_RESULT", JSON.stringify({
          status: metaResponse.status,
          ok: metaResponse.ok,
          body: await metaResponse.text()
        }));
      }

      for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
        if (change?.field !== "feed") {
          console.log("META_PAGE_CHANGE_IGNORED", JSON.stringify({ field: change?.field ?? null }));
          continue;
        }

        hasFeedChange = true;
        const value = change?.value ?? {};
        console.log("FACEBOOK_FEED_EVENT", JSON.stringify(value));
        if (value?.item !== "comment") {
          console.log("FACEBOOK_FEED_NON_COMMENT", JSON.stringify({
            item: value?.item ?? null,
            verb: value?.verb ?? null,
            postId: value?.post_id ?? null
          }));
        } else {
          // Transport observability only. Engines owns CTA trigger classification.
          console.log("FACEBOOK_COMMENT_TRANSPORT", JSON.stringify({
            verb: value?.verb ?? null,
            postId: value?.post_id ?? null,
            commentId: value?.comment_id ?? null
          }));
        }
      }
    }

    if (hasFeedChange && env.ENGINES_META_PAGE_INGRESS_URL) {
      const forwarded = await fetch(env.ENGINES_META_PAGE_INGRESS_URL, {
        method: "POST",
        headers: {
          "content-type": request.headers.get("content-type") || "application/json",
          "x-hub-signature-256": signature
        },
        body: rawBody
      });

      const forwardedBody = await forwarded.text();
      console.log("META_ENGINE_BRIDGE_RESULT", JSON.stringify({
        status: forwarded.status,
        ok: forwarded.ok,
        body: forwardedBody
      }));

      if (!forwarded.ok) {
        return new Response("Engine Bridge Failed", { status: 502 });
      }
    } else if (hasFeedChange) {
      console.log("META_ENGINE_BRIDGE_NOT_CONFIGURED");
    }

    return new Response("EVENT_RECEIVED", {
      status: 200,
      headers: { "Content-Type": "text/plain" }
    });
  }
};

async function verifyMetaSignature(rawBody, providedSignature, appSecret) {
  if (typeof providedSignature !== "string" || !providedSignature.startsWith("sha256=")) {
    return false;
  }

  const providedHex = providedSignature.slice("sha256=".length).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(providedHex)) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const expectedHex = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, rawBody)))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  if (expectedHex.length !== providedHex.length) return false;
  let difference = 0;
  for (let i = 0; i < expectedHex.length; i += 1) {
    difference |= expectedHex.charCodeAt(i) ^ providedHex.charCodeAt(i);
  }
  return difference === 0;
}

// Edge authority boundary:
// - verify Meta authenticity;
// - distinguish transport families for observability;
// - optionally forward the exact signed raw body to Engines;
// - DO NOT classify "CITA" or any other public text into business actions here.
// Engines FacebookCommentAdapter owns trigger semantics and the canonical CTA mapping.


function legalPage(env, heading, body) {
  const appName = env.ENGINES_APP_DISPLAY_NAME || "Engines Channels PoC";
  const contact = env.ENGINES_LEGAL_CONTACT_EMAIL || "privacy@example.invalid";
  const escapedHeading = escapeHtml(heading);
  const escapedAppName = escapeHtml(appName);
  const escapedContact = escapeHtml(contact);

  return new Response(
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapedAppName} — ${escapedHeading}</title>
  <style>
    body{font-family:system-ui,sans-serif;max-width:760px;margin:64px auto;padding:0 24px;line-height:1.6;color:#111827}
    h1{line-height:1.2} a{color:#1741ff}
  </style>
</head>
<body>
  <h1>${escapedHeading}</h1>
  <p><strong>${escapedAppName}</strong></p>
  ${body}
  <p>Contact: <a href="mailto:${escapedContact}">${escapedContact}</a></p>
  <p>Last updated: September 21, 2026</p>
</body>
</html>`,
    {
      status: 200,
      headers: {
        "content-type": "text/html; charset=UTF-8",
        "x-content-type-options": "nosniff"
      }
    }
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
