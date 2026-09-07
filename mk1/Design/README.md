# MK1 Design Index

Active detailed design artifacts remain on the bounded MK1 branches. This `main` index preserves navigation and cross-generation structure.

Primary current design areas:

```text
Customer registration policy/projection
Durable ChannelExecutionCore
WebChat rendering/recovery
Telegram Bot API adapter/renderer/runner
WhatsAppTransportPort
Kapso transport
Meta Cloud API transport
Services revision/snapshot semantics
Services ↔ Appointment integration
Scheduler architecture boundary
```

Current consolidated design source:

`build/mk1-customer-channels-integrated/mk1/Design/`

Design must preserve live Temporal state as the conversation authority. Provider-specific UI copy or payload mapping cannot create a second business state machine.
