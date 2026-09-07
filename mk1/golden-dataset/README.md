# MK1 Golden Dataset Index

MK1 Golden expectations freeze deterministic provider/core behavior before certification.

Current expectation families include:

```text
Services lifecycle/revision/snapshot behavior
Appointment → canonical Services selection
Channel event replay/conflict semantics
Customer Registration Policy V2
soft-duplicate resolution
Telegram provider normalization/rendering
WhatsApp provider normalization/rendering
Kapso webhook authentication/payload cases
Meta Cloud API verification/message cases
```

The executable fixtures remain on their source branches under `mk1/golden-dataset/`.

Rule:

> Golden expectations are not rewritten merely to make a failing implementation pass. Change the expectation only through an explicit architecture/design decision with documented reason.
