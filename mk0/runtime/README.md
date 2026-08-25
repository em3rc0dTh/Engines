# mk0 Runtime — B0

## Status

**B0 CERTIFIED**

Certification record:

```text
mk0/Build/evidence/B0-runtime-certification-2026-08-24.md
```

This directory is the first executable layer of mk0.

It deliberately contains no Customer registration business logic yet. B1 is the active Build stage for pure canonical contracts and versioned RegistrationPolicy semantics.

## Certified runtime profile

```text
Node.js              >= 20
Certified Node       v24.19.0
TypeScript           7.0.2
Temporal TS SDK      1.22.0
Temporal CLI         1.8.1
Temporal Server      1.31.2 observed in certification
Temporal Web UI      2.50.1 observed in certification
Temporal endpoint    localhost:7233
Temporal Web UI      localhost:8233
Namespace            default
Task Queue           engines-mk0-registration
PostgreSQL           17.8
MongoDB              8.0.29
Web framework        none
```

Temporal's local dev server is used only for the mk0 laboratory runtime. Application PostgreSQL/MongoDB remain independent persistence planes.

The npm dependency graph is frozen by the committed `package-lock.json`.

## Prerequisites

- Node.js 20+;
- npm;
- Docker + Docker Compose;
- Temporal CLI 1.8.1 available in `PATH` for parity with the certified laboratory profile.

## Install

```bash
cd mk0/runtime
npm ci
cp .env.example .env
```

Use `npm ci` for certified reproduction. Do not silently regenerate the dependency graph during ordinary B0 verification.

The current B0 code uses defaults matching `.env.example`; exporting equivalent environment variables is also valid.

## Start application persistence

```bash
npm run infra:up
npm run infra:status
npm run probe:stores
```

Expected logical evidence:

```text
B0_POSTGRES_OK
B0_MONGO_OK
B0_STORES_SMOKE_OK
```

## Start Temporal

In a separate terminal:

```bash
cd mk0/runtime
npm run temporal:dev
```

Expected local endpoints:

```text
Temporal gRPC  localhost:7233
Temporal UI    http://localhost:8233
```

## Start the B0 Worker

In another terminal:

```bash
cd mk0/runtime
npm run worker:b0
```

Expected evidence includes:

```text
B0_WORKER_STARTED
Task Queue = engines-mk0-registration
Worker state = RUNNING
```

## Execute the real Temporal smoke Workflow

In another terminal:

```bash
cd mk0/runtime
npm run smoke:b0
```

Expected terminal evidence:

```text
B0_TEMPORAL_SMOKE_OK
```

The JSON result contains a real Temporal `workflowId`, `runId` and Task Queue. The same Workflow Execution is observable in Temporal Web UI/Event History during the live laboratory run.

## Static check

```bash
npm run check
```

## Stop

Stop the Worker and Temporal dev server with their process shutdown controls, then:

```bash
npm run infra:down
```

## Certified B0 evidence

The final locked certification recorded:

```text
source commit                 f66b37a22a2591d98085d528b2afe6675c094a24
GitHub Actions run            32806301801
artifact                      mk0-b0-runtime-evidence-32806301801
artifact digest               sha256:090548b7e4a6073a0f36c0439ae3461309c871b3ad0df5c8720230acb523f03b
Temporal Workflow ID          mk0-b0-smoke:3961d684-6447-4fc5-ab24-df14daebb341
Temporal Run ID               01a03705-b65d-7ee3-a833-0f1e6f80b6ab
Task Queue                    engines-mk0-registration
PostgreSQL probe              PASS
MongoDB probe                 PASS
locked npm install            PASS
TypeScript type-check         PASS
Temporal Service              PASS
Temporal Web UI               PASS
Temporal Worker               PASS
Temporal Workflow             PASS
no business schema in B0      PASS
```

The detailed immutable record is stored under `mk0/Build/evidence/` and the corresponding GitHub Actions artifact contains the structured JSON, lockfile and logs.

## Explicit non-goals preserved

B0 does not implement:

- `RegistrationPolicy` runtime model;
- `RegisterNewCustomer` business Workflow;
- Query/Update data collection;
- Customer duplicate policy execution;
- PostgreSQL Customer tables;
- MongoDB audit schema;
- AttachmentStore;
- Postman transport;
- Agent/Hermes;
- scheduling.

Those remain correctly assigned to later authorized stages.

## Next stage

> **B1 — Canonical Contracts + Versioned RegistrationPolicy**

B1 is pure/deterministic contract work. It must not collapse B2–B6 concerns into the contract layer.
