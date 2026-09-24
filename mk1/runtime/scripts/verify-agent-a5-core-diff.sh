#!/usr/bin/env bash
set -euo pipefail

BASE="${1:-}"
if [[ -z "$BASE" ]]; then
  git fetch origin main --quiet
  BASE="$(git merge-base origin/main HEAD)"
fi

changed="$(git diff --name-only "$BASE"...HEAD)"

forbidden='^(mk1/runtime/migrations/|mk1/runtime/src/persistence/|mk1/runtime/src/orchestration/|mk1/runtime/src/services/|mk1/runtime/src/scheduler/|mk1/runtime/src/contracts/register-new-customer/|mk1/runtime/src/contracts/register-new-appointment/|mk1/runtime/src/contracts/services-engine/|mk1/runtime/src/contracts/scheduler-engine/|mk1/runtime/src/contracts/integration-engine/|mk1/runtime/src/cta/channel-core/(appointment-channel-execution|types|validation|idempotency|adapter-registry)\\.ts$)'

violations="$(printf '%s\n' "$changed" | grep -E "$forbidden" || true)"
if [[ -n "$violations" ]]; then
  echo "A5_CORE_DIFF_VIOLATION"
  printf '%s\n' "$violations"
  exit 1
fi

echo "A5 changed files:"
printf '%s\n' "$changed"
echo "CORE_DIFF_ZERO_PASS"
