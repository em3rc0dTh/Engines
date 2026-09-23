# Agent Layer A2 — Integrated Journey Test Matrix

Date: 2026-09-22

## Deterministic

### A2-01 phase projection

`WAITING_FOR_DATE` exposes only `SET_DATE`.

### A2-02 action translation

Agent:

~~~json
{
  "action": "SET_DATE",
  "arguments": { "naturalDate": "viernes" }
}
~~~

must become the existing channel action:

~~~json
{
  "action": "SET_DATE",
  "payload": { "dateInput": "viernes" }
}
~~~

### A2-03 confirmed-state narration

The Agent proposes one action, Engine executes it, A2 re-reads durable state, and a second model pass narrates with no allowed actions.

## Real integrated journey

Deterministic setup:

~~~text
START_APPOINTMENT
existing Customer
SELECT_MANAGED_ENTITY
SELECT_SERVICE
SELECT_OFFERING
WAITING_FOR_DATE
~~~

Natural tail:

~~~text
"Mejor el viernes."
"A las <first real Scheduler slot>."
"Sí, confirma."
~~~

Expected terminal state:

~~~text
phase = CREATED
workflowStatus = COMPLETED
managedEntityId = men_me1_phys_logan
schedulerReservationId present
legacy resourceReservationId absent
~~~

## Visible response quality

Each visible reply must:

~~~text
be non-empty
avoid internal action names
avoid internal ids
avoid claiming unconfirmed execution
~~~

## Node budget

Capture real running memory for:

~~~text
postgres
mongo
temporal
worker
cta
channel-core
webchat
llama-server
~~~

Then add a 1024 MB OS/Docker reserve.

Gate:

~~~text
accounted total <= 8192 MB
llama-server <= 2304 MB
product workloads pinned to CPUs 0-3
~~~
