# MK0 Runtime

Executable local laboratory for the completed MK0 Engines orchestration proof.

## Current status

```text
RegisterNewCustomer       ✅ certified
AttachmentStore/B7        ✅ certified
Lab Console / trace       ✅ certified
RegisterNewAppointment    ✅ certified
MK0 local objective       ✅ complete
Production deployment     ❌ not certified
```

Historical B0 runtime details remain in [`../Build/evidence/B0-runtime-certification-2026-08-24.md`](../Build/evidence/B0-runtime-certification-2026-08-24.md). This README describes the **current** runtime rather than the first stage that created it.

## Runtime profile

```text
Node.js            >= 20
Certified CI Node  24.19.0
TypeScript         7.0.2
Temporal TS SDK    1.22.0
Temporal CLI       1.8.1 in Compose image
Task Queue         engines-mk0-registration
PostgreSQL         17.8
MongoDB            8.0.29
Web framework      none
CTA HTTP           127.0.0.1:8787
Temporal gRPC      localhost:7233
Temporal UI        localhost:8233
```

## Runtime structure

```text
src/
├── contracts/
│   ├── register-new-customer/
│   └── register-new-appointment/
├── cta/
│   ├── cli/
│   └── http/
├── lab-console/
├── observability/
├── orchestration/temporal/
│   ├── activities/
│   ├── clients/
│   ├── ports/
│   ├── workers/
│   └── workflows/
└── persistence/
    ├── attachments/
    ├── mongo/
    └── postgres/

migrations/
scripts/
postman/
```

## Install

From WSL/Linux:

```bash
cd mk0/runtime
npm ci
npm run check
```

Fast regression surface:

```bash
npm run test:b1
npm run test:b3
npm run test:b7
npm run test:lab-console
npm run test:appointment
```

## Start the complete local laboratory

```bash
docker compose up --build -d
docker compose ps
```

The Compose dependency chain is deliberate:

```text
PostgreSQL + MongoDB
        ↓
      migrate
        ↓
      Temporal
        ↓
       Worker
        ↓
        CTA
```

Do not use `--no-deps` when starting CTA as if it were standalone.

Health:

```bash
curl -fsS http://127.0.0.1:8787/health
```

Expected operation advertisement:

```json
{
  "ok": true,
  "service": "engines-mk0-cta",
  "temporalAddress": "temporal:7233",
  "operations": [
    "RegisterNewCustomer",
    "RegisterNewAppointment"
  ]
}
```

## Customer Lab Console

```bash
npm run lab:console
```

The launcher waits for CTA health rather than assuming the HTTP process is ready immediately after Docker reports `Started`.

Key commands:

```text
new <alias>
attach <alias> <workflowId>
sessions
use <alias>
show
set name <value>
set email <value>
set phone[1] <value>
set phone[2] <value>
finish
watch [seconds]
trace
exit
```

The Customer console demonstrates durable multi-round state, explicit finalization and unified read-only evidence projection.

## Appointment Lab Console

```bash
npm run lab:appointment
```

Key commands:

```text
new <alias>
customer name <value>
customer email <value>
customer phone <value>
customer id <customerId>
customer resolve
services
service <n|id|code|name>
products
product <n|id|code|name>
date <human date>
slots
slot <n|HH:MM>
show
finish
watch [seconds]
trace
exit
```

Supported laboratory date forms include canonical/numeric dates, English/Spanish weekday names and selected relative terms (`hoy/today`, `mañana/tomorrow`, `ayer/yesterday`). Past dates are rejected.

## Persistence

### PostgreSQL

Application business truth includes:

```text
customers
customer_contacts
customer_phones
customer_documents
registration_commands
customer_attachment_refs
service_catalog
service_products
service_availability_rules
appointment_commands
appointments
```

### MongoDB

Semantic audit collections:

```text
execution_audit
appointment_audit
```

MongoDB is not canonical Customer/Appointment truth.

### AttachmentStore

Local laboratory implementation uses the shared filesystem volume under `/data/attachments` with staged ingress, content-addressed committed objects and SHA-256 integrity.

## Current migrations

```text
001_b5_registration_customer.sql
002_b6_registration_finalization.sql
003_b7_customer_attachment_refs.sql
004_appointment_catalog_and_booking.sql
```

Compose executes all current migrations before Worker startup.

## Certification scripts

Current high-value scripts:

```text
scripts/b7-compose-certification.sh
scripts/certify-contact-input-validation.ts
scripts/certify-lab-console-trace.ts
scripts/certify-phone-slot-order.ts
scripts/certify-register-new-appointment.ts
```

The consolidated release workflow runs the current regression surface and these clean-laboratory certifications.

## Stop vs reset

Preserve data/history:

```bash
docker compose down
```

Destructive laboratory reset:

```bash
docker compose down -v --remove-orphans
```

Do not use the destructive reset casually when a physical run/history is still useful as evidence.

## Scope boundary

This runtime is a local architecture laboratory. It does not certify production deployment, public exposure/security hardening, a complete Scheduler/ResourceReservation engine, Agent/Hermes or the final Engines UI.
