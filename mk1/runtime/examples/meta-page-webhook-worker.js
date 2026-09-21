const MESSENGER_PATH = "/webhooks/meta/messenger";
const COMMENTS_PATH = "/webhooks/meta/facebook-comments";
const GRAPH_API_VERSION = "v26.0";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const validPath =
      url.pathname === MESSENGER_PATH ||
      url.pathname === COMMENTS_PATH;

    if (!validPath) {
      return new Response("Not Found", { status: 404 });
    }

    if (request.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (
        mode === "subscribe" &&
        token === env.META_WEBHOOK_VERIFY_TOKEN &&
        challenge
      ) {
        return new Response(challenge, {
          status: 200,
          headers: { "Content-Type": "text/plain" }
        });
      }

      return new Response("Forbidden", { status: 403 });
    }

    if (request.method === "POST") {
      try {
        const payload = await request.json();
        console.log("META_PAYLOAD", JSON.stringify(payload));

        const entries = Array.isArray(payload?.entry)
          ? payload.entry
          : [];

        for (const entry of entries) {
          const messagingEvents = Array.isArray(entry?.messaging)
            ? entry.messaging
            : [];

          for (const messagingEvent of messagingEvents) {
            console.log("MESSENGER_EVENT", JSON.stringify(messagingEvent));

            const senderId = messagingEvent?.sender?.id;
            const pageId = messagingEvent?.recipient?.id;
            const messageText = messagingEvent?.message?.text;
            const postbackPayload = messagingEvent?.postback?.payload;

            if (senderId && pageId && postbackPayload) {
              console.log("MESSENGER_POSTBACK", JSON.stringify({
                senderId,
                pageId,
                payload: postbackPayload
              }));
              continue;
            }

            if (!senderId || !pageId || !messageText) {
              continue;
            }

            console.log("MESSENGER_MESSAGE", JSON.stringify({
              senderId,
              pageId,
              text: messageText
            }));

            const metaResponse = await fetch(
              "https://graph.facebook.com/" +
                GRAPH_API_VERSION + "/" + pageId + "/messages",
              {
                method: "POST",
                headers: {
                  Authorization: "Bearer " + env.META_PAGE_ACCESS_TOKEN,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  recipient: { id: senderId },
                  message_type: "RESPONSE",
                  message: {
                    text: 'Engines received: "' + messageText + '" ✅'
                  }
                })
              }
            );

            console.log("META_SEND_RESULT", JSON.stringify({
              status: metaResponse.status,
              body: await metaResponse.text()
            }));
          }

          const changes = Array.isArray(entry?.changes)
            ? entry.changes
            : [];

          for (const change of changes) {
            if (change?.field !== "feed") {
              console.log("META_PAGE_CHANGE_IGNORED", JSON.stringify({
                field: change?.field
              }));
              continue;
            }

            const value = change?.value ?? {};
            console.log("FACEBOOK_FEED_EVENT", JSON.stringify(value));

            const item = value?.item;
            const verb = value?.verb;

            if (item !== "comment") {
              console.log("FACEBOOK_FEED_NON_COMMENT", JSON.stringify({
                item,
                verb,
                postId: value?.post_id ?? null
              }));
              continue;
            }

            if (verb !== "add") {
              console.log("FACEBOOK_COMMENT_IGNORED", JSON.stringify({
                item,
                verb,
                commentId: value?.comment_id ?? null
              }));
              continue;
            }

            const commentEvent = {
              pageId: entry?.id ?? null,
              postId: value?.post_id ?? null,
              commentId: value?.comment_id ?? null,
              senderId: value?.sender_id ?? value?.from?.id ?? null,
              message: value?.message ?? "",
              createdTime: value?.created_time ?? null,
              published: value?.published ?? null
            };

            console.log("FACEBOOK_COMMENT_EVENT", JSON.stringify(commentEvent));

            const normalizedMessage =
              String(commentEvent.message).trim().toLowerCase();

            const appointmentTriggers = new Set([
              "cita",
              "appointment",
              "agendar",
              "agendar cita"
            ]);

            if (!appointmentTriggers.has(normalizedMessage)) {
              console.log("FACEBOOK_COMMENT_NO_CTA", JSON.stringify({
                commentId: commentEvent.commentId,
                message: commentEvent.message
              }));
              continue;
            }

            console.log("FACEBOOK_COMMENT_CTA", JSON.stringify({
              type: "START_APPOINTMENT",
              source: "facebook_comment",
              pageId: commentEvent.pageId,
              postId: commentEvent.postId,
              commentId: commentEvent.commentId,
              senderId: commentEvent.senderId,
              message: commentEvent.message,
              publicTriggerOnly: true,
              privateContinuationRequired: true
            }));
          }
        }

        return new Response("EVENT_RECEIVED", {
          status: 200,
          headers: { "Content-Type": "text/plain" }
        });
      } catch (error) {
        console.error(
          "META_WEBHOOK_ERROR",
          error instanceof Error
            ? error.stack || error.message
            : String(error)
        );

        return new Response("Bad Request", { status: 400 });
      }
    }

    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET, POST" }
    });
  }
};

// IMPORTANT:
// This reference reflects the physically tested pre-HMAC edge.
// Before production, verify X-Hub-Signature-256 against the exact raw body
// using META_APP_SECRET, then parse JSON only after successful verification.
