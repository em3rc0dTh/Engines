# Integration Registry — CLI

## Identity

```text
Surface          CLI / local interactive laboratory
Repository target  Engines-Integration-CLI (optional extraction)
Primary MK       MK0 inherited into MK1
Provider         none
External secret  none
```

CLI is a developer/operator connection surface to Engines, not a separate business authority.

## Status

```text
MK0 CLI CTA adapter                    ✅ historical certified surface
RegisterNewCustomer interactive lab    ✅ proven
RegisterNewAppointment interactive lab ✅ proven
External provider certification        N/A
```

## Architecture

```text
CLI input
→ parser/canonicalizer
→ canonical CTA operation
→ Temporal Workflow
→ PostgreSQL / Mongo / AttachmentStore
```

CLI may collect and normalize user input. It may not own Customer, Services, Scheduler or persistence policy.

## Brainstorming

The CLI exists as the fastest deterministic/manual laboratory surface. It is useful for proving Workflow behavior independently from browser/provider mechanics.

## Mining Site / Quarries

Primary evidence lives under MK0 Build/Test/mining-site history. Use the MK0 closure and specimen receipts rather than inventing a new CLI-specific product claim.

## Design

Input/output is terminal-oriented, but the canonical business operations are the same ones exposed through HTTP and later channel adapters.

## Plan

CLI is a stable lab surface. No new provider gate is required unless CLI packaging is extracted into its own repository or its canonical contract changes.

## Build / Test authority

Stable source is `main/mk0/runtime`. MK0 release/closure is the certification authority. Later MK1 branches inherit the core behavior but do not rewrite MK0 proof.

## Golden expectations

Customer and Appointment Golden Dataset fixtures live under `mk0/golden-dataset/`.

## Bootstrap

```bash
git switch main
cd mk0/runtime
npm ci
npm run check
docker compose up --build -d
npm run lab:console
```

Appointment interactive laboratory:

```bash
npm run lab:appointment
```

## Non-claims

CLI proof does not certify WebChat, Telegram, WhatsApp, production networking or external-provider behavior.

## Extraction note

CLI can remain inside Engines because it has no external provider dependency. If repository-per-surface becomes strict, extract only the CLI parsing/UX layer and preserve canonical operations in Engines.
