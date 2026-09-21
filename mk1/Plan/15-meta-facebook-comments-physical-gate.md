# Meta Facebook Comments — physical gate plan

Date: 2026-09-21

## Closed

- Manage Pages use case added;
- required Page permissions exposed as test-ready;
- Webhooks configured on object `Page`, not `User`;
- existing Messenger Page callback preserved;
- `feed` subscribed;
- Meta dashboard `feed` sample reached Cloudflare Worker with HTTP 200;
- Worker classified dashboard `item=status` as non-comment;
- Messenger regression remained bidirectionally functional after shared routing;
- sanitized synthetic `item=comment / verb=add / message=CITA` replay returned HTTP 200;
- synthetic replay emitted `FACEBOOK_COMMENT_EVENT` and `FACEBOOK_COMMENT_CTA`;
- deterministic repository decoder + FacebookCommentAdapter tests cover signed provider comment canonicalization.

## Open

1. deploy raw-body `X-Hub-Signature-256` enforcement at the permanent edge;
2. prove invalid signature rejection physically;
3. obtain a real Facebook provider comment event;
4. route that real event through the repository FacebookCommentAdapter;
5. prove canonical CTA -> Temporal -> persistence;
6. replay the exact provider event and prove no duplicate business effect;
7. complete applicable public production access/review.

## Gate separation

~~~text
dashboard feed sample                 != real comment
synthetic comment replay              != provider physical proof
deterministic signed unit test         != deployed edge HMAC proof
~~~
