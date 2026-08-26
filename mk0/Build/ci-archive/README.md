# Archived MK0 Stage CI

These workflow definitions are preserved exactly for historical reproducibility but are no longer active GitHub Actions workflows.

## Why they were archived

B0–B6 and the original attachment-free Golden core were **stage gates**. Keeping them under `.github/workflows/` caused every later pull request to rerun historical gates whose assumptions were sometimes intentionally superseded by later stages.

That created noisy or misleading CI status.

During MK0 closure they were moved here so:

- historical implementation remains inspectable;
- old receipts remain reproducible by deliberate/manual reconstruction;
- modern PRs are judged by the current runtime surface rather than obsolete intermediate assertions;
- GitHub Actions history remains intact.

## Archived definitions

```text
mk0-b0-ci.yml
mk0-b1-ci.yml
mk0-b2-ci.yml
mk0-b3-ci.yml
mk0-b4-ci.yml
mk0-b5-ci.yml
mk0-b6-ci.yml
mk0-core-golden-release.yml
```

## Current active CI

Current workflow definitions remain under `.github/workflows/` and focus on:

- B7/AttachmentStore regression;
- B7 clean Compose certification;
- Lab Console / unified trace certification;
- RegisterNewAppointment certification;
- MK0 release closure.

## Evidence rule

Archiving a workflow does not invalidate its historical receipt. A historical claim must continue to cite the exact source SHA and Actions run that executed it.
