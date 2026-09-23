# MK1 Evidence Registry

This folder is an evidence navigation layer.

Runtime-bound receipts must name the source that was actually executed. A later documentation commit never retroactively replaces the physical/runtime authority recorded by a receipt.

## Canonical current closure

### Channel × ManagedEntity physical seal

- [channel-managed-entity-provider-physical-seal-2026-09-22.md](channel-managed-entity-provider-physical-seal-2026-09-22.md)
- Physical lineage: cf9f8b8… → bd25a49… → 5561836…
- Verdict: SEALED

### PRE-AGENT integrated seal

- [platform-pre-agent-final-seal-2026-09-22.md](platform-pre-agent-final-seal-2026-09-22.md)
- Executed exact-head authority: 5561836de64b0e8dc3cd0c71b77316940affd337
- Platform Solidity run: 35759357879
- Primary artifact: platform-solidity-seal-35759357879
- Digest: sha256:dc0c267b96037169fbe62af02862ba3f9cdd5b2f1264679eff2908162958d4ef
- Verdict: PRE-AGENT SEALED

### Agent Layer A0 conversational contract

- [agent-layer-a0-certification-2026-09-22.md](agent-layer-a0-certification-2026-09-22.md)
- Executed exact-head authority: 3b53202b55e2c7309ea2bea7fc0dfb481329d0ab
- Run: 35784801132
- Seal artifact: mk1-agent-a0-seal-35784801132
- Digest: sha256:9ca44bdd7dd67a860f6c101094b1ad515c5509ee49af449cde2421e4446302c3
- Verdict: AGENT A0 SEALED

### Agent Layer A1 real local inference

- [agent-layer-a1-real-local-inference-certification-2026-09-22.md](agent-layer-a1-real-local-inference-certification-2026-09-22.md)
- Executed exact-head authority: 2be1ad51456c7e511d180b7f562fcfc54b4bca63
- Run: 35803641746
- Real-model artifact: mk1-agent-a1-real-local-35803641746
- Real-model digest: sha256:617fa5b22673cb11fdcc8183ed476d4111a0fb964508532119c2150df7e3c671
- Seal artifact: mk1-agent-a1-seal-35803641746
- Seal digest: sha256:085bbeb337df6a1d034c8d19402876df3d0359aa8c6a8544956c3bcdb6d3b4ee
- Measured llama-server RSS: 1,942 MB
- Median real-model latency: 5,916 ms
- Verdict: AGENT A1 SEALED

### Agent Layer A2 integrated journey

- [agent-layer-a2-integrated-journey-certification-2026-09-22.md](agent-layer-a2-integrated-journey-certification-2026-09-22.md)
- Executed exact-head authority: 9438e5eb85fab866d437effe7063b18afdff500e
- Run: 35807358759
- Integrated artifact: mk1-agent-a2-integrated-35807358759
- Integrated digest: sha256:10db90e06c6a5354a82ba9dc3cb3788449cc17deb0151e89c1c688a26d7b26bc
- Seal artifact: mk1-agent-a2-seal-35807358759
- Seal digest: sha256:c5724e5ab08002a40cc9620929ba8aa95502550da59d69a8fe5cc33e96c62e0d
- Accounted node memory: 4,057 MB / 8,192 MB
- Headroom: 4,135 MB
- Verdict: AGENT A2 SEALED

### Agent Layer A3 durable runtime

- [agent-layer-a3-runtime-certification-2026-09-23.md](agent-layer-a3-runtime-certification-2026-09-23.md)
- Executed exact-head authority: 9e22f3a58c06a24627302f03856adfe4c62c36df
- Run: 35867288650
- Runtime artifact: mk1-agent-a3-runtime-35867288650
- Runtime digest: sha256:bfa01ba7e58c42f5d992a629b7f942a4a30488aea6875be7d7d9ba526a56b951
- Seal artifact: mk1-agent-a3-seal-35867288650
- Seal digest: sha256:f1eadf01c5349f32b8f263006d6c75561c33e921fe6841e6d00c60413b225837
- Verdict: AGENT A3 SEALED / READY FOR FIRST MANUAL AGENT TRIAL

## Historical receipts

Older receipts in this directory remain valid only within their documented source, scope and truth boundaries. Do not reinterpret a historical ResourceReservation receipt as proof of the current SchedulerReservation topology.

## Privacy rule

Do not commit provider tokens, webhook secrets, private phone numbers, private contact data or screenshots containing sensitive account material.
