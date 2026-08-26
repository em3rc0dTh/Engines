# B0 — Runtime Certification Evidence

## Verdict

**B0 CERTIFIED**

Project-local approval date: `2026-08-24`

Certification execution completed in GitHub Actions at `2026-08-25T03:45:23Z` (UTC).

This evidence certifies the runtime/repository skeleton only. It does not certify `RegisterNewCustomer` business behavior, which begins in later Build stages.

---

## Certified source

```text
Repository:       em3rc0dTh/Engines
Branch:           build/mk0-b0-runtime-skeleton
Source commit:    f66b37a22a2591d98085d528b2afe6675c094a24
Dependency lock:  mk0/runtime/package-lock.json
Lock commit:      d15e07d1d1bf2c47fe9d5a552e227b4bbed74522
```

The final certification used `npm ci`, not an unconstrained dependency resolution.

---

## GitHub Actions evidence

```text
Workflow:       mk0 B0 runtime certification
Run ID:         32806301801
Run attempt:    1
Conclusion:     SUCCESS
Artifact ID:    9548264954
Artifact name:  mk0-b0-runtime-evidence-32806301801
Artifact digest:
sha256:090548b7e4a6073a0f36c0439ae3461309c871b3ad0df5c8720230acb523f03b
```

The artifact contains:

```text
b0-runtime-evidence.json
package-lock.json
worker.log
smoke.log
```

The artifact is retained by the GitHub Actions evidence policy for the configured retention window.

---

## Observed runtime

```text
Node.js:           v24.19.0
npm:               11.17.0
Temporal CLI:      1.8.1
Temporal Server:   1.31.2
Temporal Web UI:   2.50.1
Temporal TS SDK:   1.22.0
PostgreSQL:        17.8
MongoDB:           8.0.29
```

Configured Temporal boundary:

```text
Address:     localhost:7233
Web UI:      http://localhost:8233
Namespace:   default
Task Queue:  engines-mk0-registration
```

---

## Real Temporal Workflow evidence

Observed smoke result:

```json
{
  "event": "B0_TEMPORAL_SMOKE_OK",
  "ok": true,
  "probeId": "3961d684-6447-4fc5-ab24-df14daebb341",
  "workflowId": "mk0-b0-smoke:3961d684-6447-4fc5-ab24-df14daebb341",
  "runId": "01a03705-b65d-7ee3-a833-0f1e6f80b6ab",
  "taskQueue": "engines-mk0-registration"
}
```

Worker evidence includes:

```text
Workflow bundle compiled successfully
B0_WORKER_STARTED
Task Queue = engines-mk0-registration
Worker state = RUNNING
```

This is a real Temporal Client → Service → Task Queue → Worker → Workflow execution. It is not an in-process substitute.

---

## Application-store evidence

```text
PostgreSQL connectivity probe  PASS
MongoDB connectivity probe     PASS
```

Observed server versions:

```text
PostgreSQL 17.8
MongoDB 8.0.29
```

B0 creates no Customer schema or Customer/Appointment business mutation.

---

## Certified assertions

The final evidence manifest reports:

```text
lockedInstall          PASS
typecheck              PASS
composeModel           PASS
temporalService        PASS
temporalWebUi          PASS
temporalWorker         PASS
temporalWorkflow       PASS
noBusinessSchemaInB0   PASS
```

The final workflow was read-only with respect to repository contents (`permissions: contents: read`).

---

## Reproducibility history

B0 was not declared certified after the first green signal.

Before the final locked run:

- an initial CI configuration error was identified and corrected;
- subsequent full runtime runs proved Temporal/stores successfully;
- structured evidence artifacts were added;
- a green run generated the first dependency lockfile;
- that certified lockfile was committed;
- workflow write permission was removed;
- the final certification used `npm ci` against the committed dependency graph.

This sequence is retained as engineering evidence rather than hidden.

---

## B0 closure

B0 acceptance requirements are satisfied:

```text
reproducible Node runtime                 PASS
real Temporal Service                     PASS
Temporal Web UI                           PASS
real Worker / Task Queue                  PASS
real smoke Workflow / Workflow ID / Run ID PASS
PostgreSQL connectivity                   PASS
MongoDB connectivity                      PASS
locked dependency graph                   PASS
zero Customer/Appointment business logic  PASS
structured evidence artifact              PASS
```

Therefore:

> **B0 — Runtime / Repository Skeleton = CERTIFIED.**

Next authorized Build stage:

> **B1 — Canonical Contracts + Versioned RegistrationPolicy**

B7 AttachmentStore remains gated.
