#!/usr/bin/env bash
set -euo pipefail

CTA=http://127.0.0.1:8787
FIXTURES=../golden-dataset/fixtures
PNG_SHA=248c43a8627c6db8f95626beaca3b056bcfafcd036a4344dd3ed14e1e704da84
TXT_SHA=c4de8a6ee133dfc935ccb27071170ea692d1261f30cb18cd35269a1d09cf1609

json_field() {
  node -e 'const fs=require("fs"); const x=JSON.parse(fs.readFileSync(0,"utf8")); const p=process.argv[1].split("."); let v=x; for (const k of p) v=v?.[k]; if (v===undefined||v===null) process.exit(2); process.stdout.write(String(v));' "$1"
}

wait_cta() {
  for _ in $(seq 1 90); do
    if curl -fsS "$CTA/health" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  echo 'CTA did not become healthy' >&2
  docker compose ps >&2 || true
  docker compose logs cta worker temporal >&2 || true
  return 1
}

stage() {
  local ingress=$1 file=$2 media=$3 sha=$4 name=$5
  curl -fsS -X POST "$CTA/mk0/attachments/stage" \
    -H "content-type: $media" \
    -H "x-media-type: $media" \
    -H "x-ingress-ref: $ingress" \
    -H "x-expected-sha256: $sha" \
    -H "x-file-name: $name" \
    --data-binary "@$file" > "/tmp/${ingress}.json"
  test "$(json_field attachment.ingressRef < "/tmp/${ingress}.json")" = "$ingress"
  test "$(json_field attachment.sha256 < "/tmp/${ingress}.json")" = "$sha"
}

start_workflow() {
  local file=$1
  curl -fsS -X POST "$CTA/mk0/register-new-customer" \
    -H 'content-type: application/json' \
    --data-binary "@$file"
}

wait_phase() {
  local workflow_id=$1 expected=$2
  for _ in $(seq 1 90); do
    local body phase
    body="$(curl -fsS "$CTA/mk0/register-new-customer/$workflow_id")"
    phase="$(printf '%s' "$body" | json_field state.phase || true)"
    if [ "$phase" = "$expected" ]; then
      printf '%s' "$body"
      return 0
    fi
    if [ "$phase" = 'FAILED' ] && [ "$expected" != 'FAILED' ]; then
      printf '%s\n' "$body" >&2
      return 1
    fi
    sleep 1
  done
  echo "workflow $workflow_id did not reach $expected" >&2
  return 1
}

pg_scalar() {
  docker compose exec -T postgres psql -U engines -d engines_mk0 -Atc "$1" | tr -d '[:space:]'
}

mongo_scalar() {
  docker compose exec -T mongo mongosh engines_mk0 --quiet --eval "$1" | tail -1 | tr -d '[:space:]'
}

wait_cta

echo '== GD-003 one attachment =='
stage ing_ci_gd003_a "$FIXTURES/synthetic-id-front-v1.png" image/png "$PNG_SHA" 'synthetic-id-front-v1.png'
cat >/tmp/gd003.json <<JSON
{"businessSlug":"golden-business","idempotencyKey":"b7-compose-gd003","correlationId":"b7-compose-gd003","draft":{"customer":{"type":"person","name":"B7 GD003 Customer","contact":{"phones":[],"email":"b7-gd003@example.test"}},"attachments":[{"ingressRef":"ing_ci_gd003_a","kind":"identity_document","displayName":"Synthetic ID front","mediaType":"image/png","sha256":"$PNG_SHA","byteLength":75}]}}
JSON
GD003_START="$(start_workflow /tmp/gd003.json)"
GD003_WF="$(printf '%s' "$GD003_START" | json_field workflowId)"
GD003_FINAL="$(wait_phase "$GD003_WF" CREATED)"
test "$(printf '%s' "$GD003_FINAL" | json_field state.created)" = 'true'
test "$(pg_scalar "select count(*) from customer_attachment_refs ar join customer_contacts c on c.customer_id=ar.customer_id where c.email_normalized='b7-gd003@example.test'")" = '1'
test "$(mongo_scalar "db.execution_audit.countDocuments({workflowId:'$GD003_WF',eventType:'ATTACHMENT_COMMITTED'})")" = '1'

echo '== GD-004 multiple attachments =='
stage ing_ci_gd004_a "$FIXTURES/synthetic-id-front-v1.png" image/png "$PNG_SHA" 'synthetic-id-front-v1.png'
stage ing_ci_gd004_b "$FIXTURES/synthetic-supporting-document-v1.txt" text/plain "$TXT_SHA" 'synthetic-supporting-document-v1.txt'
cat >/tmp/gd004.json <<JSON
{"businessSlug":"golden-business","idempotencyKey":"b7-compose-gd004","correlationId":"b7-compose-gd004","draft":{"customer":{"type":"person","name":"B7 GD004 Customer","contact":{"phones":[],"email":"b7-gd004@example.test"}},"attachments":[{"ingressRef":"ing_ci_gd004_a","kind":"identity_document","mediaType":"image/png","sha256":"$PNG_SHA","byteLength":75},{"ingressRef":"ing_ci_gd004_b","kind":"supporting_document","mediaType":"text/plain","sha256":"$TXT_SHA","byteLength":67}]}}
JSON
GD004_START="$(start_workflow /tmp/gd004.json)"
GD004_WF="$(printf '%s' "$GD004_START" | json_field workflowId)"
wait_phase "$GD004_WF" CREATED >/tmp/gd004-final.json
test "$(pg_scalar "select count(*) from customer_attachment_refs ar join customer_contacts c on c.customer_id=ar.customer_id where c.email_normalized='b7-gd004@example.test'")" = '2'
test "$(mongo_scalar "db.execution_audit.countDocuments({workflowId:'$GD004_WF',eventType:'ATTACHMENT_COMMITTED'})")" = '2'
test "$(mongo_scalar "db.execution_audit.countDocuments({workflowId:'$GD004_WF',eventType:'REGISTRATION_COMPLETED'})")" = '1'

echo '== GD-009 transient AttachmentStore failure =='
stage ing_ci_gd009_a "$FIXTURES/synthetic-id-front-v1.png" image/png "$PNG_SHA" 'synthetic-id-front-v1.png'
docker compose stop worker >/dev/null
CERT_ID="$(docker compose run -d --no-deps \
  -e B7_FAIL_ATTACHMENT_COMMIT_ATTEMPTS=1 \
  -e B7_FAIL_ATTACHMENT_INGRESS_REF=ing_ci_gd009_a \
  cta npm run worker:b7:cert)"
cleanup_cert() { docker rm -f "$CERT_ID" >/dev/null 2>&1 || true; docker compose start worker >/dev/null 2>&1 || true; }
trap cleanup_cert EXIT
sleep 5
cat >/tmp/gd009.json <<JSON
{"businessSlug":"golden-business","idempotencyKey":"b7-compose-gd009","correlationId":"b7-compose-gd009","draft":{"customer":{"type":"person","name":"B7 GD009 Customer","contact":{"phones":[],"email":"b7-gd009@example.test"}},"attachments":[{"ingressRef":"ing_ci_gd009_a","kind":"identity_document","mediaType":"image/png","sha256":"$PNG_SHA","byteLength":75}]}}
JSON
GD009_START="$(start_workflow /tmp/gd009.json)"
GD009_WF="$(printf '%s' "$GD009_START" | json_field workflowId)"
wait_phase "$GD009_WF" CREATED >/tmp/gd009-final.json
docker logs "$CERT_ID" > /tmp/gd009-cert-worker.log 2>&1
grep -q 'B7_ATTACHMENT_COMMIT_INJECTED_FAILURE' /tmp/gd009-cert-worker.log
test "$(pg_scalar "select count(*) from customer_attachment_refs ar join customer_contacts c on c.customer_id=ar.customer_id where c.email_normalized='b7-gd009@example.test'")" = '1'
test "$(mongo_scalar "db.execution_audit.countDocuments({workflowId:'$GD009_WF',eventType:'ATTACHMENT_COMMITTED'})")" = '1'
cleanup_cert
trap - EXIT
sleep 3

echo '== GD-010 permanent post-stage integrity mismatch =='
stage ing_ci_gd010_a "$FIXTURES/synthetic-id-front-v1.png" image/png "$PNG_SHA" 'synthetic-id-front-v1.png'
docker compose exec -T cta sh -lc "printf 'CORRUPTED-B7-GD010' > /data/attachments/ingress/ing_ci_gd010_a/payload.bin"
cat >/tmp/gd010.json <<JSON
{"businessSlug":"golden-business","idempotencyKey":"b7-compose-gd010","correlationId":"b7-compose-gd010","draft":{"customer":{"type":"person","name":"B7 GD010 Customer","contact":{"phones":[],"email":"b7-gd010@example.test"}},"attachments":[{"ingressRef":"ing_ci_gd010_a","kind":"identity_document","mediaType":"image/png","sha256":"$PNG_SHA","byteLength":75}]}}
JSON
GD010_START="$(start_workflow /tmp/gd010.json)"
GD010_WF="$(printf '%s' "$GD010_START" | json_field workflowId)"
GD010_FINAL="$(wait_phase "$GD010_WF" FAILED)"
test "$(printf '%s' "$GD010_FINAL" | json_field state.failure.code)" = 'ATTACHMENT_INTEGRITY_MISMATCH'
test "$(pg_scalar "select count(*) from customer_attachment_refs ar join customer_contacts c on c.customer_id=ar.customer_id where c.email_normalized='b7-gd010@example.test'")" = '0'
test "$(mongo_scalar "db.execution_audit.countDocuments({workflowId:'$GD010_WF',eventType:'ATTACHMENT_COMMITTED'})")" = '0'
test "$(mongo_scalar "db.execution_audit.countDocuments({workflowId:'$GD010_WF',eventType:'REGISTRATION_COMPLETED'})")" = '0'
GD010_STATUS="$(pg_scalar "select status from registration_commands where workflow_id='$GD010_WF'")"
case "$GD010_STATUS" in COMPLETED_*) echo "unexpected successful PostgreSQL status $GD010_STATUS" >&2; exit 1;; esac

cat > /tmp/b7-compose-evidence.json <<JSON
{"schemaVersion":"mk0.b7.compose-evidence.v1","gd003":{"workflowId":"$GD003_WF","status":"PASS"},"gd004":{"workflowId":"$GD004_WF","status":"PASS"},"gd009":{"workflowId":"$GD009_WF","status":"PASS","retryObserved":true},"gd010":{"workflowId":"$GD010_WF","status":"PASS","failureCode":"ATTACHMENT_INTEGRITY_MISMATCH","postgresStatus":"$GD010_STATUS"},"verdict":"B7_ATTACHMENT_RUNTIME_4_OF_4_PASS"}
JSON
cat /tmp/b7-compose-evidence.json
