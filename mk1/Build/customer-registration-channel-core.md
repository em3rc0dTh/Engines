# Customer registration channel core — build and evidence

## Brainstorming / Quarry

C1B already owns durable inbound replay, identity-conflict detection and conversation binding. Its execution class was Appointment-specific. Registration therefore reuses the repository semantics and adds an operation-specific executor instead of copying them into Telegram or WhatsApp.

## Design / Plan

Canonical operations are `START_CUSTOMER_REGISTRATION`, `PROVIDE_CUSTOMER_DATA`, and `FINALIZE_CUSTOMER_REGISTRATION`. Start requires explicit affirmative consent, selects policy V2, and binds the conversation to `RegisterNewCustomer`. Updates query Temporal state and project `knownFields`, `missingFields`, `nextAction` into provider-independent render intents.

## Golden dataset

Shared cases CH-RNC-001 through CH-RNC-009 are represented by contract, projection, C1B replay/conflict and transport suites. A consent-negative event is intentionally normalized as no start operation by each adapter; a forged start without `consentAccepted: true` is rejected by the core.

## Test / Evidence

- TypeScript compile: PASS
- Customer policy suite: PASS
- Channel projection/core suite: PASS
- Existing C1B/WebChat regression suite: PASS

This gate is deterministic code evidence. It does not claim a live provider or full external Temporal/PostgreSQL laboratory certification.
