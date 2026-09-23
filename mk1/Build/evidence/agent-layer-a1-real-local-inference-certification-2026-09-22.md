# Agent Layer A1 — Real Local Inference Certification

Date: 2026-09-22
Branch: `feat/agent-layer-a1-local-inference`

## Verdict

A1 is sealed for one bounded real local conversational inference path.

Executed exact-head authority:

~~~text
2be1ad51456c7e511d180b7f562fcfc54b4bca63
~~~

GitHub Actions:

~~~text
workflow:
MK1 Agent Layer A1 Local Inference

run:
35803641746

result:
PASS

jobs:
deterministic-provider-contract  PASS
real-local-inference            PASS
protected-pre-agent-regressions PASS
agent-a1-seal                   PASS
~~~

Artifacts:

~~~text
mk1-agent-a1-deterministic-35803641746
sha256:4160611e8cfe048e9d409496dfc1f7cbda1c697bacced990a01cd7a36f1d0730

mk1-agent-a1-real-local-35803641746
sha256:617fa5b22673cb11fdcc8183ed476d4111a0fb964508532119c2150df7e3c671

mk1-agent-a1-seal-35803641746
sha256:085bbeb337df6a1d034c8d19402876df3d0359aa8c6a8544956c3bcdb6d3b4ee
~~~

## Real runtime authority

~~~text
llama.cpp
version tag: v0.4.1
commit: b29c606e28a01b1bc8c1351026a0fa6e616bf6c4

model:
Qwen/Qwen2.5-1.5B-Instruct-GGUF
qwen2.5-1.5b-instruct-q4_k_m.gguf

model bytes:
1,117,320,736

model SHA-256:
6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e
~~~

The model is downloaded during certification. Its weights are not stored in Engines.

## Runtime profile

~~~text
CPU threads:              4
batch threads:            4
context:                  4096
parallel generations:     1
maximum output:           128
GPU required:             no
~~~

Measured maximum `llama-server` resident memory:

~~~text
1,989,036 KB
1,942 MB
~~~

A1 gate:

~~~text
maximum allowed inference RSS:
2,304 MB

result:
PASS
~~~

This leaves approximately 6 GB of the product's 8 GB node target outside the measured inference process. It does **not** itself prove that the complete Engines node stays below 8 GB. That integrated proof remains A2.

## Real conversational proof

The exact authority head executed five real model turns.

### Date

User:

~~~text
Mejor el viernes.
~~~

Real model result:

~~~json
{
  "kind": "PROPOSE_ACTION",
  "reply": "Perfecto, revisemos el viernes.",
  "proposedAction": {
    "action": "SET_DATE",
    "arguments": {
      "naturalDate": "viernes"
    }
  },
  "schemaVersion": 1
}
~~~

Latency:

~~~text
14,619 ms
~~~

### ManagedEntity

User:

~~~text
El Logan.
~~~

Real model result:

~~~json
{
  "kind": "PROPOSE_ACTION",
  "reply": "Perfecto, vamos con el Logan.",
  "proposedAction": {
    "action": "SELECT_MANAGED_ENTITY",
    "arguments": {
      "managedEntityId": "men_logan"
    }
  },
  "schemaVersion": 1
}
~~~

Latency:

~~~text
5,975 ms
~~~

The canonical id was copied from the Engine projection; it was not invented by the model.

### Offering

User:

~~~text
La ejecutiva.
~~~

Real model result:

~~~json
{
  "kind": "PROPOSE_ACTION",
  "reply": "Perfecto, vamos con la opción ejecutiva.",
  "proposedAction": {
    "action": "SELECT_OFFERING",
    "arguments": {
      "offeringId": "off_executive"
    }
  },
  "schemaVersion": 1
}
~~~

Latency:

~~~text
5,916 ms
~~~

### Finalization proposal

User:

~~~text
Sí, confirma.
~~~

Real model result:

~~~json
{
  "kind": "PROPOSE_ACTION",
  "reply": "Perfecto, confirmemos esa cita.",
  "proposedAction": {
    "action": "FINALIZE_APPOINTMENT",
    "arguments": {}
  },
  "schemaVersion": 1
}
~~~

Latency:

~~~text
5,271 ms
~~~

The reply proposes confirmation; it does not falsely state that Engines already executed it.

### Natural conversation

User:

~~~text
Gracias!
~~~

Real model result:

~~~json
{
  "kind": "RESPOND",
  "reply": "¡De nada! 😊",
  "schemaVersion": 1
}
~~~

Latency:

~~~text
2,480 ms
~~~

## Aggregate latency

~~~text
cases:              5
median latency:     5,916 ms
maximum latency:   14,619 ms
~~~

This is a CPU-only GitHub-hosted laboratory measurement, not a production SLA.

## Soul / Personality proof

The real test used a resolved profile including:

~~~text
name: Mia
role: Customer Assistant
warmth: 0.85
formality: 0.30
verbosity: CONCISE
locale: es-PE
~~~

The model produced short, natural Spanish replies while remaining below the A0 execution boundary.

A1 additionally checked that user-facing replies did not leak canonical action names or internal ids and did not claim execution before Engine confirmation.

## Protocol correction discovered during A1

The first real-model run loaded the model and server successfully but failed at the A0 validator because the small model did not reliably produce:

~~~text
schemaVersion = 1
~~~

That failed run was:

~~~text
run:
35787168626

head:
c615988843efccb4de106739aeae55aee4f411f6

failure:
Agent contract invalid:
decision.schemaVersion must be 1
~~~

The validator was **not** weakened.

The correction moved protocol-version ownership to the provider adapter:

~~~text
model decides:
kind
reply
proposedAction

adapter owns:
schemaVersion = 1

A0 still validates the final AgentDecision.
~~~

This is the correct authority split: protocol metadata is an Engines concern, not a language-model reasoning task.

The corrected runtime authority is:

~~~text
2be1ad51456c7e511d180b7f562fcfc54b4bca63
~~~

## Certified boundary

A1 certifies:

~~~text
real local ~1.5B model load                     PASS
CPU-only llama.cpp inference                    PASS
Q4_K_M candidate                                PASS
A0 contract preserved                           PASS
schema-constrained model output                 PASS
provider-owned protocol version                 PASS
Spanish conversational golden slice             PASS
natural concise user-facing responses           PASS
no internal identifier/action leakage in reply  PASS
canonical id copy from Engine projection        PASS
Engine allowed-action boundary                  PASS
measured local latency                          PASS
measured inference RSS <= 2304 MB               PASS
protected PRE-AGENT regressions                  PASS
~~~

## Non-claims

A1 does not certify:

~~~text
whole Engines node <= 8 GB RAM
production latency SLA
production concurrency
Telegram Agent journey
WhatsApp Agent journey
long-memory conversation
model quality outside this golden slice
RAG
MCP
multi-model routing
production readiness
~~~

## Next gate — A2

A2 should perform the first integrated Agent journey:

~~~text
real Channel
  ↓
Agent Layer
  ↓
real local 1.5B model
  ↓
validated AgentDecision
  ↓
existing Engine action
  ↓
Temporal / domain engines
  ↓
result projected back to Agent
  ↓
natural Channel response
~~~

A2 must additionally measure the **complete operational node** against:

~~~text
4 vCPU
8 GB RAM total
no GPU
~~~

Final verdict:

~~~text
AGENT A1 ✅ SEALED
~~~
