# ME1 physical Case A — premature strong-identity prompt repair

Date: 2026-09-21

## Physical observation

During the first valid Case A browser execution, the durable workflow resolved:

~~~text
name: ME1 Unique Customer
customerId: cus_me1_phys_unique
customer.status: EXISTING
email: SKIPPED
phone: SKIPPED
managedEntity.status: NEEDS_SELECTION
~~~

and exposed the expected vehicles:

~~~text
Renault Logan 2018
Nissan Sentra 2020
~~~

However, the WebChat transcript briefly rendered:

~~~text
No encontramos un cliente único llamado ME1 Unique Customer. Ingresa tu correo para continuar.
~~~

before the automatic Temporal name-resolution round trip completed.

The user did not have to provide email, and the durable state later proved the unique existing Customer correctly, but the message violated the physical UX requirement that Case A must not ask for stronger identity when name-only resolution succeeds.

## Root cause

The WebChat renderer treated any name-only `DRAFT` state outside the explicit `RESOLVING_CUSTOMER` phase as evidence that email was required.

The channel core actually performs:

~~~text
PROVIDE_CUSTOMER(name)
  -> auto RESOLVE_CUSTOMER
  -> wait for Temporal resolution result
~~~

There is a short durable handoff where:

~~~text
customer.status = DRAFT
phase = WAITING_FOR_CUSTOMER
nextAction = RESOLVE_CUSTOMER
issues = []
~~~

That state means "resolution is in flight", not "email is required".

## Repair

WebChat now renders the email prompt only when durable workflow evidence requires stronger identity:

~~~text
customer.status = AMBIGUOUS
or
issues contains CUSTOMER_INCOMPLETE
or
issues contains CUSTOMER_NOT_FOUND
or
issues contains CUSTOMER_AMBIGUOUS
~~~

During the name-only auto-resolution handoff it disables input and renders the verification message instead.

The workflow-map projection was updated to the same rule:

~~~text
name-only resolution in flight
  -> Customer email = PENDING
  -> Resolve Customer = ACTIVE

durable stronger-identity requirement
  -> Customer email = ACTIVE
~~~

It also avoids transiently activating phone merely because email has just been supplied.

## Regression coverage

Added deterministic view tests for:

1. name-only resolution in flight;
2. durable stronger-identity requirement;
3. email supplied without premature phone activation.

## Truth boundary

The production Temporal customer-resolution behavior was already correct. This repair addresses WebChat presentation/state projection only.

The previous Case A browser observation is not accepted as the final UX proof because the transient false email prompt was visible. Case A must be rerun on the repaired exact head before ME-SEAL.
