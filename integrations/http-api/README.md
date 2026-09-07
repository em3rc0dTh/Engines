# Integration Registry — HTTP / Postman CTA

## Identity

```text
Surface            HTTP / Postman-compatible CTA
Repository target  Engines-Integration-HTTP-API (optional extraction)
Primary MK         MK0 inherited into MK1
Provider           none
External secret    none for local laboratory
```

## Status

```text
MK0 Postman Customer collection      ✅ 37 / 37 PASS
HTTP health/local laboratory          ✅ physically proven
RegisterNewCustomer over HTTP         ✅ certified
Provider/external internet exposure   ❌ not certified
```

## Architecture

```text
HTTP request
→ transport parsing + validation
→ canonical CTA operation
→ Temporal
→ same Workflow Library
```

HTTP is a transport surface. Endpoint syntax must not become the canonical domain contract.

## Brainstorming

HTTP/Postman exists as a reproducible integration boundary and operator/debugging surface. It allows non-UI clients to exercise the same Engine without embedding business rules in the route layer.

## Mining Site / Quarries

Evidence is indexed in MK0 Test/Build receipts and the Postman collection history.

## Design

Transport responsibilities:

```text
request parsing
basic shape validation
canonical operation mapping
HTTP status/error rendering
```

Not transport responsibilities:

```text
Customer duplicate truth
appointment slot capacity truth
Services policy
Workflow state transitions
```

## Plan

Keep HTTP as a canonical lab/API surface. Any future public API gate requires separate auth/security/rate-limit/versioning certification.

## Build / Test authority

Stable runtime:

```text
main → mk0/runtime
CTA http://127.0.0.1:8787
```

## Bootstrap

```bash
git switch main
cd mk0/runtime
npm ci
npm run check
docker compose up --build -d
curl -fsS http://127.0.0.1:8787/health
```

## Golden expectations

Use MK0 Customer/Appointment Golden Dataset and the certified Postman collection. Do not treat ad-hoc curl success as equivalent to the full certified collection.

## Non-claims

```text
public API production exposure
OAuth/API-key product design
internet hardening
rate-limit certification
third-party API SLA
```

## Extraction note

Like CLI, HTTP is provider-neutral enough to remain in the core repo unless a separate API product is created. If extracted, keep the canonical operation contract owned by Engines.
