# MK1 Messaging Stack — Consolidation Receipt

Date: 2026-09-04
Integration branch: `build/mk1-customer-channels-integrated`
Status: **CONSOLIDATED**

## Purpose

Collapse the temporary stacked-PR topology into one stable MK1 Customer/channel integration anchor without rewriting certified runtime source SHAs and without moving `main`, `developer`, `release/mk0-complete` or `mk0/runtime`.

## Merge strategy

A fresh integration branch was created from the messaging design base. Each stacked PR was retargeted to the integration branch and merged **in order using merge commits**.

This preserves the original branch/source commits referenced by certification receipts.

## Consolidated PR chain

```text
PR #14 Customer Registration Policy V2
  merge → 703959c7e79783354a05b9b57178e99a71d5d613

PR #15 Durable Customer Registration Channel Core
  merge → 7a64c85bd96d9ef3b6051528227ddddf99001bb9

PR #16 Telegram Customer Registration Transport
  merge → 1434290c61b338a4dd461b0bfc6a6826cccdcc99

PR #17 WhatsApp Customer Registration Transport
  merge → a8cd8924677fe9d9b488aaaefa038606fad70295

PR #18 Local Interactive Customer Registration E2E
  merge → f86edcd71d66726473041a7897825a80a340811b

PR #19 Customer Soft-Duplicate Resolution
  merge → 43e3d547d93fb3b723690e2f793143de93e3bcec

PR #20 Telegram Official Bot API Physical Transport
  merge → 94f342d731e2272c025c28b007635eccfe5f7f8a
```

## Preserved evidence authorities

Consolidation does not replace prior runtime evidence. Examples retained unchanged in history include:

```text
C2/C4 local E2E source   bfccd4a795400d2311201a880453b61b08d0b56a
B2 certified source      36afff68af3237bd6431fd643d7d969e5452a296
C2P physical source      28dd5c9f2dd2352d3e11b83cc6602cea1b568760
```

The final integrated branch contains the corresponding documentation/evidence receipts.

## Current integrated capability

```text
Customer Registration Policy V2                 ✅
Durable Customer Registration Channel Core      ✅
Telegram provider-independent transport          ✅
WhatsApp provider-independent transport port     ✅
Local Telegram/WhatsApp real-Temporal E2E        ✅
Customer soft-duplicate resolution               ✅
Telegram official Bot API physical provider      ✅ SEALED
```

## Branch cleanup boundary

The former stack branches are now cleanup candidates, but **no branch was deleted automatically**.

Deletion should happen only after explicit user approval and after checking no future PR uses those branches as a base.

## Next bounded gate

```text
C4P — Meta WhatsApp Cloud API physical proof
```

That gate must branch from this consolidated integration anchor and must keep Meta-specific webhook/Graph API concerns below `WhatsAppTransportPort`.
