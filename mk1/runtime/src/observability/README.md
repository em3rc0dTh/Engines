# MK0 Lab Console observability contract

The Lab Console is an operator-facing view over the certified `RegisterNewCustomer` workflow. It is not a new business authority.

## Mutation boundary

The console mutates workflow state only through the existing CTA/Temporal interaction surface:

- start `RegisterNewCustomer`
- `ProvideCustomerData` Workflow Update
- `FinalizeRegistration` Workflow Update for `EXPLICIT_FINALIZE` sessions

The execution-trace endpoint is read-only.

## Completion semantics

Two completion modes intentionally coexist:

- `AUTO_WHEN_COMPLETE` — the historical/default behavior used by existing automated callers. Once the RegistrationPolicy minimum is satisfied, workflow processing may continue automatically.
- `EXPLICIT_FINALIZE` — the Lab Console behavior. Reaching the RegistrationPolicy minimum moves the workflow to `READY_TO_FINALIZE` and keeps it RUNNING. The operator may continue enriching or correcting the durable draft. Only `finish`/`submit` sends `FinalizeRegistration` and closes data collection.

This distinction prevents policy completeness (`name` plus `phoneOrEmail` for the golden policy) from being confused with the human statement “I am done entering this customer.”

## Interactive phones

The canonical Customer model supports multiple phones. The Lab Console exposes 1-based commands (`phone[1]`, `phone[2]`, ...). Because `CustomerPatch.contact.phones` is an array replacement patch, the console reads the current durable draft and resends the complete phone array when changing one phone slot.

## Evidence

`GET /mk0/executions/:workflowId/trace` projects evidence from:

- Temporal Workflow state and Event History
- MongoDB application audit
- PostgreSQL registration/customer effects
- AttachmentStore staged/committed metadata

Temporal is the mandatory orchestration authority. Corroborating stores report explicit availability/warnings rather than silently turning unknown evidence into PASS.
