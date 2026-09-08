# CTA Orchestration Register Appointment PoC — gate ledger

Date: 2026-09-08

| Gate | Implemented | Certified now | Remaining truth boundary |
|---|---:|---:|---|
| G1 compatibility boundary | yes | deterministic | none |
| G2 existing adapter wrappers | yes | Web/Telegram/WhatsApp regression | physical appointment runs pending CI/provider runtime |
| G3 CTA ingress persistence | yes | deterministic | PostgreSQL runtime gate in CI |
| G4 deterministic router | yes | deterministic | none |
| G5 Register Appointment consolidation | yes | CatalogOffering compatibility path | Services/Scheduler extraction is outside this slice |
| G6 persistence graph + compensation | yes | code/test harness | clean-stack CI must seal |
| G7 first real existing adapter E2E | no | no | real provider event required |
| G8 all existing adapters | partial | deterministic only | physical appointment CTA per provider required |
| G9 Messenger | yes | deterministic + signature/parser | Meta app/webhook physical run required |
| G10 Facebook Comments | yes | deterministic + signature/parser | Meta Page subscription/private continuation physical run required |
| G11 TikTok | boundary only | signature + synthetic mapping | provider capability/access for comment or DM delivery is not established |
| G12 multichannel | partial | canonical convergence | physical provider matrix pending |
| G13 regression + merge | in progress | 124 local tests green | CI and final review pending |

## Merge rule

Do not merge until the branch workflow proves:

1. migration 008 on a clean database;
2. one CTA ingress creates one Workflow and one operational graph;
3. exact replay starts no second Workflow;
4. `ResourceReservation` finishes `BOOKED` on success;
5. forced Appointment creation failure leaves `ResourceReservation` as `RELEASED`;
6. inherited adapter and runtime regressions remain green.

Physical provider certification is recorded separately and cannot be inferred from deterministic fixtures or old customer-registration evidence.
