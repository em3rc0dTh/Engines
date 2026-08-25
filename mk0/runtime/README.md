# mk0 Runtime — B0

## Status

**B0 IMPLEMENTED IN REPOSITORY / RUNTIME PROOF PENDING**

This directory is the first executable layer of mk0.

It deliberately contains no Customer registration business logic yet.

## Runtime choice

```text
Node.js              >= 20
TypeScript           7.0.2
Temporal TS SDK      1.22.0
Temporal Service     official CLI dev server
Temporal endpoint    localhost:7233
Temporal Web UI      localhost:8233
Namespace            default
Task Queue           engines-mk0-registration
PostgreSQL           Docker
MongoDB              Docker
Web framework        none
```

Temporal's local dev server is used only for the mk0 laboratory runtime. Application PostgreSQL/MongoDB remain independent persistence planes.

## Prerequisites

- Node.js 20+;
- npm;
- Docker + Docker Compose;
- Temporal CLI available in `PATH`.

## Install

```bash
cd mk0/runtime
npm install
cp .env.example .env
```

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

The JSON result contains a real Temporal `workflowId`, `runId` and Task Queue. The same Workflow Execution must be visible in Temporal Web UI.

## Static check

```bash
npm run check
```

## Stop

Stop the Worker and Temporal dev server with their process shutdown controls, then:

```bash
npm run infra:down
```

## B0 completion evidence

Do not mark B0 complete until a real execution records:

```text
repository commit SHA
Node version
Temporal CLI/server version
Temporal SDK version
Temporal endpoint
Namespace
Task Queue
Workflow ID
Run ID
Worker observation
Temporal Web UI/Event History observation
PostgreSQL probe result
MongoDB probe result
restart/re-run observation
zero Customer/Appointment mutation assertion
```

The evidence belongs under `mk0/runtime/evidence/`.

## Explicit non-goals

B0 does not yet implement:

- `RegistrationPolicy`;
- `RegisterNewCustomer`;
- Query/Update collection;
- Customer duplicate policy;
- PostgreSQL Customer tables;
- MongoDB audit schema;
- AttachmentStore;
- Postman transport;
- Agent/Hermes;
- scheduling.

Those belong to later authorized stages.
