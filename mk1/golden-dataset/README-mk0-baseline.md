# MK0 Golden Dataset and Expectation Manifests

## Purpose

This directory stores machine-readable expectations and synthetic fixtures used to keep MK0 claims explicit.

## RegisterNewCustomer — real predeclared Golden Dataset

Canonical file:

[`register-new-customer-v0.json`](register-new-customer-v0.json)

This is the MK0 Golden Dataset that was frozen before the Customer Build/certification sequence and later exercised by the staged/integrated gates.

Effective certified accounting:

```text
GD-001 … GD-018
18 / 18 PASS
```

Evidence nuance:

```text
14 attachment-free cases
+
4 B7 attachment cases
=
18 / 18 effective PASS
```

Do not claim a single historical 18-case Actions run if the evidence came from separate certified artifacts.

Synthetic binary/document fixtures live under [`fixtures/`](fixtures/).

## RegisterNewAppointment — transparent closure manifest

File:

[`register-new-appointment-closure-manifest-v0.json`](register-new-appointment-closure-manifest-v0.json)

This file is intentionally labelled:

```text
POST_CERTIFICATION_CLOSURE_MANIFEST
predeclaredBeforeBuild = false
```

The second specimen was implemented/certified rapidly after the Customer laboratory proved reusable orchestration. Its automated expectations were encoded in the certification harness before the clean Compose run, but they were **not** established as a formal repository Golden Dataset before implementation began.

We preserve that historical truth instead of retroactively calling the manifest a pre-Build Golden Dataset.

The manifest records the executed Appointment certification markers:

```text
APPOINTMENT_NEW_CUSTOMER_CHILD_PASS
APPOINTMENT_CATALOG_PASS
APPOINTMENT_PAST_DATE_REJECTED
APPOINTMENT_DATE_AND_SLOTS_PASS
APPOINTMENT_BOOKING_PASS
APPOINTMENT_IDEMPOTENCY_REPLAY_PASS
APPOINTMENT_SLOT_CONFLICT_PASS
MK0_REGISTER_NEW_APPOINTMENT_PASS
```

## Rule for future stages

MK0 closure reinforces the preferred order:

```text
benchmark / quarry evidence
→ predeclared expectations
→ architecture
→ Build
→ runtime evidence
```

Future Engines stages should freeze their formal Golden Dataset **before Build** whenever a Golden gate is part of the plan.

A post-certification manifest may document what happened; it may not rewrite history and pretend the expectations were predeclared.
