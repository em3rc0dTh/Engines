# Integration Repository Template

Use this skeleton for every provider/channel repository extracted from Engines.

```text
.
├── README.md
├── Brainstorming/
│   └── README.md
├── Architecture/
│   └── README.md
├── Design/
│   └── README.md
├── Plan/
│   └── README.md
├── Build/
│   ├── README.md
│   └── evidence/
├── Test/
│   └── README.md
├── mining-site/
│   ├── README.md
│   └── quarries/
│       └── README.md
├── golden-dataset/
│   └── README.md
├── runtime/                     # when executable code belongs to the integration
└── .github/workflows/
```

## Root README minimum

Every integration README must identify:

```text
integration name/provider
repository target
Engine contract version / MK generation
current status
source/extraction lineage
architecture boundary
configuration/secrets contract
local bootstrap
physical-provider bootstrap if applicable
deterministic test commands
CI authority
human/physical evidence
known limitations/non-claims
```

## Provider rule

Integration code may authenticate, normalize, render and transport. It must not own Customer, Services, Scheduler, Appointment, Temporal or canonical persistence business rules.

## Evidence rule

Code alone is not a pass. Every bounded claim must bind to exact source and a receipt. Preserve failures and superseded runs rather than deleting them from history.
