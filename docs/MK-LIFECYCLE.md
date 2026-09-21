# Engines MK Lifecycle

## Purpose

Every Engines generation (`mk0`, `mk1`, `mk2`, ...) is a bounded product/architecture generation with its own documentary and evidence chain. A later MK may inherit or evolve earlier contracts, but it never rewrites historical truth.

## Canonical progression

```text
Brainstorming
→ Mining Site / Quarries
→ Architecture
→ Design
→ Plan
→ Golden expectations
→ Build
→ Test / Evidence
→ Certification
```

### Brainstorming

Problem framing, alternatives, rejected ideas, constraints, product questions and hypotheses. Nothing in Brainstorming is automatically an approved architecture decision.

### Mining Site / Quarries

Collected evidence, source analysis, API/provider research, repository archaeology, failure forensics, external documents and bounded evidence packages. Quarries preserve where decisions came from.

### Architecture

Authority boundaries, ports/adapters, persistence ownership, domain ownership, state-machine boundaries, version seams and forbidden couplings.

### Design

Concrete contracts, message shapes, IDs, invariants, flows, state projections, provider mapping, schema design and user-visible behavior.

### Plan

Ordered gates, dependencies, proof requirements, expected evidence, stop conditions and explicit non-claims.

### Golden expectations

Frozen test expectations, fixtures, rubrics, deterministic inputs and acceptance markers. Golden expectations are written before or alongside the implementation gate; they are not retrofitted to whatever the code happened to do.

### Build

Executable implementation and implementation history. Build documentation records what changed, but code alone is never a certification.

### Test / Evidence

Automated deterministic proof, clean-environment runs, provider physical tests, human observation and failure provenance. A green job proves only the exact bounded gate it actually executes.

### Certification

The final receipt binds a claim to exact source, evidence, known limitations and non-claims.

## MK0

Status:

```text
✅ CLOSED / frozen
```

MK0 answered the architecture question: Engines can durably orchestrate multiple business workflows while keeping channels replaceable and persistence authorities explicit.

Rules:

```text
mk0/runtime is immutable for MK1+ work
MK0 receipts remain historical authority
no later docs commit may be presented as the executed MK0 source
```

## MK1

Status:

```text
🔧 ACTIVE
```

MK1 is the current Stage-2 program. It extends the Engine with:

```text
Customer/CTA multichannel semantics
WebChat durable recovery
Telegram official provider transport
WhatsApp provider transports
Services S0–S8
Scheduler architecture/runtime sequence
future provider integrations
```

Current boundary:

```text
Customer/channel provider work      advanced / major physical gates proven
Services S0–S7                      certified
Services S8                         pending
Scheduler runtime                   not certified
Agent / MCP / LLM routing           intentionally last
```

The current integrated messaging anchor is `build/mk1-customer-channels-integrated`.

## MK2 and later

A new MK is justified only when the product/architecture boundary changes materially enough that continuing to mutate the current generation would destroy historical clarity.

Minimum new-MK checklist:

```text
new generation objective
inheritance statement from previous MK
frozen baseline reference
new Brainstorming
new Architecture/Design delta
new Plan/gates
new Golden expectations
new Build/Test chain
new release/certification boundary
```

## Directory convention

Each MK should expose:

```text
mkN/
├── README.md
├── Brainstorming/
├── Architecture/        # create when architecture artifacts are first-class
├── Design/
├── Plan/
├── Build/
│   └── evidence/
├── Test/
├── mining-site/
│   └── quarries/
├── golden-dataset/
└── runtime/
```

Historical MK0 used `Design` for some architecture material. Do not destructively move old receipts just to satisfy a new folder convention; instead add indexes/links and use `Architecture/` prospectively.

## Evidence labels

Use these meanings consistently:

```text
DESIGNED              architecture/design exists
BUILT                 executable source exists
DETERMINISTIC PASS    automated bounded test passed
HUMAN VERIFIED        operator directly observed the intended behavior
PHYSICALLY VERIFIED   real external provider/device/path was exercised
SEALED                 bounded physical/certification receipt closed
PRODUCTION READY       separate production gate; never implied by the labels above
```

## Cross-version data model

The data model has its own cumulative version lineage and must be referenced from the MK that consumes it. Do not silently equate runtime MK numbers with data-model version numbers.

Current supplied data-model direction:

```text
Data Model v3  → WorkTeams / schedule rules / overrides / ResourceReservation
Data Model v4  → Operational Input Layer / granular provenance / WorkOrderRequirement / validation / corrective cycles
```

See `data-model/`.
