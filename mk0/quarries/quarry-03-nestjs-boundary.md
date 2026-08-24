# Quarry 03 — NestJS Boundary

## Status

**EXTRACTED / DESIGN BOUNDARY IDENTIFIED**

## Sources

Official NestJS documentation:

- https://docs.nestjs.com/controllers
- https://docs.nestjs.com/providers
- https://docs.nestjs.com/faq/request-lifecycle

## Source facts relevant to mk0

NestJS controllers handle incoming requests and responses.

Classification: `SOURCE_FACT`.

NestJS providers are the dependency-injected building blocks for services, repositories, helpers, and similar collaborators.

Classification: `SOURCE_FACT`.

The Nest request lifecycle can include middleware, guards, interceptors, pipes, controllers, services, exception filters, and the final server response.

Classification: `SOURCE_FACT`.

---

## mk0 boundary decision

NestJS is the **application edge**, not the durable business-process engine.

Classification: `PROJECT_DECISION`.

### NestJS owns

- route and version mapping;
- DTO parsing;
- transport validation;
- attachment-ingress transport validation;
- auth boundary when introduced;
- correlation metadata;
- `Idempotency-Key` presence/format validation;
- calling the orchestration client;
- workflow-status queries;
- mapping typed outcomes to HTTP responses.

### NestJS does not own

- durable registration phase state;
- customer persistence sequence;
- attachment commit sequence;
- durable retries;
- distributed consistency policy;
- scheduler side effects.

---

## Controller rule

The future controller should conceptually do only:

```text
HTTP request
→ validate/map
→ application command
→ orchestration client
→ HTTP acceptance/result projection
```

It should not become:

```text
HTTP request
→ insert customer
→ write log
→ save files
→ retry failures
→ invent rollback
→ respond
```

The second shape would duplicate the Orchestration Engine.

---

## `202 Accepted` decision

mk0 proposes that successful durable workflow start returns `202 Accepted` rather than holding the HTTP connection until all persistence completes.

Classification: `DESIGN_PROPOSAL`, currently preferred.

Rationale:

- caller lifecycle is decoupled from workflow lifecycle;
- Temporal durability becomes visible instead of hidden;
- Postman can test start/status explicitly;
- future channels can use the same asynchronous contract.

---

## Validation split

### Edge validation

Reject before Workflow start when the request is structurally unusable:

- malformed body;
- missing required envelope fields;
- missing idempotency key;
- invalid media type/size at attachment ingress;
- invalid route/version.

### Workflow/business validation

Belongs after durable acceptance only when it requires business state/policy or is meaningfully part of the process.

The Build design should minimize ambiguous duplication between these two layers.

---

## Open Build-time validations

- exact NestJS major version;
- DTO validation library/strategy;
- OpenAPI contract generation;
- request/body size limits;
- multipart/staging implementation;
- auth/guard policy for local mk0;
- exception-filter mapping;
- API versioning mechanism;
- Temporal client provider lifecycle.

These remain `UNKNOWN` until the Build gate.
