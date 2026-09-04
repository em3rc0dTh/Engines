# Golden Dataset — C4P Meta WhatsApp Cloud API physical proof

Date: 2026-09-04
Status: EXPECTATIONS FROZEN

## Deterministic cases

```text
WA-C4P-001 webhook subscription challenge + correct verify token → challenge returned
WA-C4P-002 wrong verify token → rejected
WA-C4P-003 valid X-Hub-Signature-256 + text message → verified normalized inbound
WA-C4P-004 valid HMAC + interactive reply button → canonical interactive id preserved
WA-C4P-005 invalid HMAC → rejected before adapter/core
WA-C4P-006 mismatched phone_number_id → rejected before Customer mutation
WA-C4P-007 status-only webhook → authenticated + acknowledged + no CTA event
WA-C4P-008 outbound text → official Graph messages shape
WA-C4P-009 outbound consent buttons → official interactive reply-button shape
WA-C4P-010 existing local WhatsApp E2E → Customer CREATED
WA-C4P-011 verified sender phone → phonePrefilled=true
WA-C4P-012 Agent=false / MCP=false
```

## Physical cases

```text
WA-C4P-P01 public HTTPS callback verifies successfully in Meta
WA-C4P-P02 real inbound WhatsApp message reaches Engines
WA-C4P-P03 first contact renders consent without starting Customer Workflow
WA-C4P-P04 affirmative button starts RegisterNewCustomer
WA-C4P-P05 verified sender phone is known and not requested again
WA-C4P-P06 name accepted through real provider
WA-C4P-P07 invalid email rejected while same registration remains recoverable
WA-C4P-P08 valid email completes Customer registration
WA-C4P-P09 completion arrives back in real WhatsApp
WA-C4P-P10 no provider secret appears in logs/evidence
```

## Expected physical state progression

```text
initial inbound
→ no binding
→ CONSENT

consent yes
→ RUNNING
→ knownFields includes customer.contact.phone
→ missingFields excludes customer.contact.phone

name
→ WAITING_FOR_REQUIRED_DATA
→ missingFields = customer.contact.email

invalid email
→ rejected
→ same Workflow / same field

valid email
→ COMPLETED / CREATED
→ nextAction = NONE
→ ✅ Registro completado
```

## Forbidden false positives

The gate does not pass if any of these occur:

```text
unsigned/tampered webhook reaches core
provider phone-number scope mismatch is accepted
WhatsApp asks for phone after verified sender prefill succeeded
invalid input starts a replacement Workflow
provider adapter decides Customer completeness
physical proof uses WhatsApp Web automation instead of Cloud API
provider secrets are committed/logged
only mocked/local payloads are tested but physical certification is claimed
```
