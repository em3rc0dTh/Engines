# Brainstorming — Next CTA Channel Proof

## Status

**BRAINSTORMING ONLY — NOT AN EXECUTION DECISION**

The purpose of a new channel is not to add product breadth for its own sake. It is to challenge the architectural invariant:

> A new channel should require a new adapter, not a duplicated business process.

The ideal proof would reuse the same Services/Scheduler/Temporal contracts after those engines are certified.

## Candidate order

### 1. Telegram — preferred first candidate

Why it is attractive for the next proof:

- simple Bot API;
- stable chat/message identifiers for correlation;
- straightforward text interaction;
- supports buttons/callback queries for deterministic selections;
- supports files/attachments if needed later;
- can be tested locally using long polling before requiring a public webhook;
- webhook mode can be introduced later as a separate external-ingress proof;
- significantly less onboarding/compliance friction than WhatsApp.

The test should ensure Telegram owns only presentation/transport concerns:

```text
Telegram message
→ Telegram CTA Adapter
→ canonical operation/update
→ Temporal
→ Services/Scheduler Activities
→ canonical result
→ Telegram rendering
```

No Service, Customer, availability, booking or cancellation rule should be implemented in the Telegram adapter.

### 2. Email — useful, but not the best first conversational proof

Advantages:

- ubiquitous;
- natural for reminders/notifications;
- good future Integration Engine target.

Complications:

- inbound conversation threading;
- reply parsing/quoting;
- asynchronous latency;
- identity/correlation policy;
- provider-specific delivery semantics.

Email is likely a stronger proof later for outbound notification/follow-up than for the first interactive replacement of CLI/Postman.

### 3. WhatsApp — strategically important, but defer the first proof

WhatsApp is highly relevant commercially, but introduces provider/account/template/webhook/onboarding concerns that can obscure whether a failure belongs to Engines or to the channel integration.

It should follow a simpler channel once the adapter contract is already proven outside CLI/HTTP laboratory clients.

### 4. Voice / IVR — defer

Voice adds speech recognition, text-to-speech, turn-taking, telephony, latency, interruptions and error-recovery semantics. It is not the right transport for the first independent channel certification.

## Suggested sequencing

```text
1. Finish core 1/2/6 audit
2. Certify Services Engine
3. Certify Scheduler Engine
4. Add Telegram adapter as the first new real channel
5. Run the same business scenarios through Telegram
6. Compare resulting Temporal/PostgreSQL/Mongo evidence with CLI/HTTP expectations
```

This sequencing keeps engine correctness and channel correctness independently diagnosable.

## Proposed Telegram certification questions

A future Telegram gate should answer:

- Can a chat start a canonical Workflow without channel-specific business logic?
- Can the same durable Workflow survive adapter restart?
- Can Telegram continue an existing Workflow using stable correlation?
- Can Service/Product choices be rendered without changing Service Engine semantics?
- Can slot choices be rendered without changing Scheduler Engine semantics?
- Can duplicate Telegram updates avoid duplicate business effects?
- Can a Telegram attachment be staged through the existing AttachmentStore boundary?
- Can the full execution still be reconstructed from Temporal + PostgreSQL + MongoDB evidence?

If these pass, Telegram becomes a strong independent proof of CTA replaceability.
