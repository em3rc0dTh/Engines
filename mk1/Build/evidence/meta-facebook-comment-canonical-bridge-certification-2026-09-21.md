# Meta Facebook Comment canonical bridge certification

Date: 2026-09-21

## Candidate

~~~text
branch: feature/meta-page-hmac-canonical-bridge
source SHA: 4da5e6e379f2d4b9022f1abaebfc40575caefe23
workflow: CTA Orchestration Appointment PoC
run: 35628769099
successful rerun job: 106430339207
artifact: cta-orchestration-poc-35628769099
artifact id: 10653471250
artifact digest: sha256:88b9f701b191b073d86eef2ac5d529a77e3e331f870d2e5cc72a849241f42702
result: PASS
~~~

## Certified path

~~~text
signed synthetic Meta Page comment
  -> Engines raw-body HMAC verification
  -> FacebookCommentAdapter
  -> CanonicalCTAEvent
  -> CanonicalCTADispatcher
  -> real Temporal RegisterNewAppointment start
  -> PostgreSQL CTA ingress persistence
  -> FACEBOOK_COMMENT channel binding persistence
  -> exact same comment_id replay
  -> one workflow / duplicate_count=1
~~~

Terminal marker:

~~~text
META_FACEBOOK_COMMENT_CANONICAL_BRIDGE_PASS
provider=facebook
channel=facebook_comment
replayed=true
duplicateCount=1
privateContinuationRequired=true
~~~

The same exact-head run also passed TypeScript, the shared CTA adapter regression suite, existing channel regressions and the baseline CTA -> Temporal -> persistence graph.

The first attempt of the same workflow run completed all runtime/product steps successfully but GitHub artifact finalization returned an intermediary HTTP 403. The failed job was rerun without changing the source SHA; the rerun completed all steps, including artifact upload, successfully. The transient artifact-service failure is retained as provenance and is not treated as a product failure.

## Truth boundary

Certified:

~~~text
repository HMAC re-verification
FacebookCommentAdapter ownership of trigger semantics
canonical CTA normalization
real Temporal workflow start
CTA ingress persistence
FACEBOOK_COMMENT binding persistence
exact provider-event replay deduplication
~~~

Not certified by this run:

~~~text
real provider-origin Facebook comment delivery
deployed Worker -> hosted Engines forwarding
private continuation completion
completed Appointment graph from the public comment
public production access/review
production readiness
~~~
