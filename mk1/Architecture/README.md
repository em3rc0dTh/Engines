# MK1 Architecture Index

MK1 architecture is **ENGINE FIRST**.

```text
CLI / HTTP / WebChat / Telegram / WhatsApp
                  ↓
          replaceable CTA boundary
                  ↓
          ChannelExecutionCore
                  ↓
     PostgreSQL durable channel ledger
                  ↓
               Temporal
                  ↓
 Customer / Services / Scheduler / persistence
```

Provider code stops at auth/verification, identity, normalization, rendering and transport.

Architecture authorities currently live primarily on:

```text
design/mk1-telegram-whatsapp-official-channels
design/mk1-services-scheduler-integration
build/mk1-customer-channels-integrated/mk1/Design/
```

This folder is prospective: historical MK1 artifacts were originally organized mainly under `Design/`. Do not destructively move those records just to create a new folder name.

Carry-forward invariants:

```text
channel != business authority
provider identity != Customer policy
Services != Scheduler
availability shown != reservation persisted
execution completion != outcome acceptance
Agent/MCP != current phase
```
