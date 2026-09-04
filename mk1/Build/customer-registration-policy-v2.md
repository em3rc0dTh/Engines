# Customer registration policy V2 — build and evidence

## Brainstorming / Quarry

V1 deliberately treats `phone OR email` as one completeness requirement. Messaging onboarding needs both contacts, but a CTA must not decide that requirement. The reusable seam is `RegistrationPolicy.required`.

## Design / Plan

Add independent canonical requirements for `customer.contact.phone` and `customer.contact.email`; preserve `customer.contact.phoneOrEmail` and the immutable V1 fixture. Publish a distinct V2 fixture with `name + phone + email`.

## Golden dataset

| Case | Expected |
|---|---|
| V1 name + email | COMPLETE |
| V1 name + phone | COMPLETE |
| V2 missing name | INCOMPLETE |
| V2 missing phone | INCOMPLETE |
| V2 missing email | INCOMPLETE |
| V2 all three | COMPLETE |

## Test / Evidence

- `npm run check`: PASS
- `node --import tsx --test src/contracts/register-new-customer/*.test.ts`: 26/26 PASS
- `npm run test:b1`: environment runner could not open its local `tsx` IPC socket (`EPERM`); the equivalent non-IPC Node runner above passed.

Automated contract evidence only. No provider/runtime certification is claimed by this gate.
