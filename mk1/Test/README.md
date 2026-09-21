# MK1 Test Index

MK1 testing is layered:

```text
unit/contract
→ deterministic provider/adaptor regression
→ clean Compose real-Temporal E2E
→ human/manual observation
→ real external-provider physical proof
```

Current human/physical truth:

```text
WebChat normal/restart recovery             ✅ human verified
Telegram local messaging                   ✅ human verified
WhatsApp local messaging                   ✅ human verified
Telegram official Bot API                  ✅ physically verified / sealed
Kapso WhatsApp Sandbox                     ✅ physically verified
Meta Cloud API direct provider             ⚪ physical pending
```

Important distinctions:

```text
mock/provider-shaped proof != external provider
local human proof != production proof
CI green != universal client compatibility
physical provider proof != Scheduler/Agent proof
```

Detailed test receipts remain on the exact source branches under `mk1/Test/` and `mk1/Build/evidence/`.
