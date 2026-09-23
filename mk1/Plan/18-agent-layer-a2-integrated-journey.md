# Agent Layer — A2 Integrated Journey Gate

Date: 2026-09-22

## Build

1. Project durable Appointment state into a bounded Agent EngineProjection.
2. Expose only phase-compatible canonical actions.
3. Translate validated Agent decisions back into CanonicalChannelEnvelope.
4. Execute through AppointmentChannelExecutionCore.
5. Re-read confirmed durable state.
6. Narrate post-action state with zero allowed actions.
7. Expose the natural-message route through WebChat C1B.
8. Run a real Qwen 1.5B local model.
9. Complete date → slot → finalize through natural messages.
10. Verify Temporal completion and SchedulerReservation persistence.
11. Pin product processes to four CPUs.
12. Measure all running service memory + model RSS + conservative OS/Docker reserve.
13. Preserve A0, A1 and PRE-AGENT regressions.

## A2 seal

A2 may be sealed only when one exact head proves:

~~~text
TypeScript
A0 regression
A1 regression
A2 deterministic tests
real local model
real WebChat route
real Temporal workflow
real Scheduler-backed Appointment
natural result narration
no internal ids/action names in visible replies
4-CPU workload affinity
accounted memory <= 8192 MB
protected PRE-AGENT regressions
~~~

## Next

A3 can expand the same integrated conversational boundary to full natural appointment capture and then physical Telegram / WhatsApp Agent journeys.
