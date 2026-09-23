# Agent Layer A4 — Dockerized Local Inference

Date: 2026-09-23

## Purpose

Make the first local human Agent trial a single Docker Compose stack instead of requiring a separately compiled and manually managed llama.cpp host process.

This does not change the Agent contract, the A0 validator, A3 runtime semantics, or Engine authority.

## Certified identities preserved

~~~text
llama.cpp commit:
b29c606e28a01b1bc8c1351026a0fa6e616bf6c4

model:
Qwen2.5 1.5B Instruct Q4_K_M

model sha256:
6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e
~~~

The container remains CPU-only and defaults to:

~~~text
threads=4
threads-batch=4
ctx-size=4096
parallel=1
predict=128
batch-size=256
ubatch-size=128
GPU required=false
~~~

## Runtime topology

~~~text
Docker Compose
├── postgres
├── mongo
├── temporal
├── worker
├── cta
├── agent-llama
│   └── Qwen2.5 1.5B Q4_K_M
├── channel-core
│   └── http://agent-llama:8080
└── webchat
~~~

The GGUF lives in the named volume:

~~~text
engines_agent_models
~~~

The startup script verifies the exact SHA-256 before serving. A missing model is downloaded once into that volume. A corrupt cached model is rejected and downloaded again.

## Local first-trial command

From `mk1/runtime`:

~~~bash
npm run lab:agent:up
~~~

This expands to the Agent overlay plus the `webchat` and `agent` profiles. The overlay:

- enables the Agent;
- points channel-core at `http://agent-llama:8080`;
- waits for the model service healthcheck before channel-core starts.

Inspect:

~~~bash
npm run lab:agent:status
curl -fsS http://127.0.0.1:8080/health
curl -fsS http://127.0.0.1:8788/health
curl -fsS http://127.0.0.1:8790/health
~~~

Logs:

~~~bash
npm run lab:agent:logs
~~~

Stop without deleting the cached model:

~~~bash
npm run lab:agent:down
~~~

Use `docker compose ... down -v` only when intentionally deleting PostgreSQL/Mongo/Temporal state and the cached GGUF volume.

## Compatibility boundary

A1/A2 CI may still override `AGENT_LLAMA_BASE_URL` with `http://host.docker.internal:8080` to preserve the existing separately measured inference proof.

The default local path is now the Docker-native service name.

## PASS boundary

Dockerization is valid when:

~~~text
agent-llama image builds
exact model SHA verifies
agent-llama /health responds
channel-core reports agent=true
webchat reports agent=true
existing A0/A1/A2/A3 regressions remain green
~~~

This is infrastructure readiness. It does not by itself certify the first human conversation.
