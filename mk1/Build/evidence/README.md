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
- Executed exact-head authority: 09ed58e2348bd850ef668fc08a0832cf41e8ae0c
- Run: 35868850796
- Runtime artifact: mk1-agent-a3-runtime-35868850796
- Runtime digest: sha256:8b6081240af91c12da8e4f529ac07316474545facff44520c9ce51b7cd21f10a
- Seal artifact: mk1-agent-a3-seal-35868850796
- Seal digest: sha256:30af96511f6145472ba2e98e4077882f7eb9df62c434cfc02e004696bf290408
- Corrective A2 integrated run: 35868856273
- Verdict: AGENT A3 SEALED / READY FOR FIRST MANUAL AGENT TRIAL

### Agent Layer A4 first human Agent trial

- [agent-layer-a4-first-human-trial-certification-2026-09-24.md](agent-layer-a4-first-human-trial-certification-2026-09-24.md)
- Final corrective main lineage: 0cab5c1f09a269bd178cd8eaa0bd38e207578600
- Human workflow: register-appointment:golden-business:04a232b4721fc6d775b0f763e30a303c
- Appointment: apt_c802e7adef088ec07c8a1449f2dd1ead
- SchedulerReservation: schedres_ec771ad2329977b562014865654a273e
- Offering/date/slot: Executive Clean · 2026-09-25 · 07:00–07:30
- Corrective protected runs: A0 36016086017 · A1 36016086163 · A2 36016086145 · A3 36016086121 · A4 36016086232
- Verdict: FIRST_HUMAN_AGENT_TRIAL_PASS / AGENT A4 HUMAN TRIAL SEALED

## Historical receipts

Older receipts in this directory remain valid only within their documented source, scope and truth boundaries. Do not reinterpret a historical ResourceReservation receipt as proof of the current SchedulerReservation topology.

## Privacy rule

Do not commit provider tokens, webhook secrets, private phone numbers, private contact data or screenshots containing sensitive account material.
