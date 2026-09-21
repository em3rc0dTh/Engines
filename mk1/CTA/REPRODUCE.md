# CTA Reproduction Guide

## Baseline

~~~bash
git clone https://github.com/em3rc0dTh/Engines.git
cd Engines/mk1/runtime
npm ci
npm run check
npm run test:cta:poc
~~~

## Canonical CTA runtime

~~~bash
docker compose down -v --remove-orphans || true
docker compose up --build -d postgres mongo temporal migrate worker cta channel-core
docker compose run --rm --no-deps -T \
  -e ENGINES_CHANNEL_URL=http://channel-core:8788 \
  -e POSTGRES_URL=postgresql://engines:engines@postgres:5432/engines_mk0 \
  cta npm run probe:cta:poc
~~~

Expected: CTA_ORCHESTRATION_POC_PASS.

## Facebook Comments signed canonical bridge

~~~bash
docker compose down -v --remove-orphans || true

META_APP_SECRET=meta-local-test-secret \
ENGINES_META_PAGE_ROUTES_JSON='{"TEST_PAGE":"golden-business"}' \
docker compose up --build -d postgres mongo temporal migrate worker cta channel-core

docker compose run --rm --no-deps -T \
  -e ENGINES_CHANNEL_URL=http://channel-core:8788 \
  -e POSTGRES_URL=postgresql://engines:engines@postgres:5432/engines_mk0 \
  -e META_APP_SECRET=meta-local-test-secret \
  cta npm run probe:meta:facebook-comment
~~~

Expected: META_FACEBOOK_COMMENT_CANONICAL_BRIDGE_PASS.

This proves signed synthetic comment -> HMAC -> adapter -> canonical CTA -> real Temporal start -> CTA/channel persistence -> exact replay dedupe.

It does not prove real provider comment delivery or completed private appointment flow.

## Secret names

Never commit values:

~~~text
META_WEBHOOK_VERIFY_TOKEN
META_PAGE_ACCESS_TOKEN
META_APP_SECRET
ENGINES_META_PAGE_ROUTES_JSON
~~~

## Current Meta truth

~~~text
Messenger real signed transport                PASS
Facebook Page.feed signed dashboard transport  PASS
deployed missing/invalid signature rejection   PASS / SEALED
Facebook signed canonical bridge               deterministic runtime certified
Facebook real provider comment                 OPEN
production readiness                           not claimed
~~~
