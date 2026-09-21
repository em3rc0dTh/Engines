# ME1 ManagedEntity — developer reconciliation receipt

Date: 2026-09-21

## Purpose

Reconcile the historical ME1 ManagedEntity branch with the current canonical `developer` baseline without losing the Meta/CTA work that was integrated after ME1 originally branched.

## Inputs

~~~text
historical ME1 head      6b333fc6ce62559ed9ddb80ced3ff65545e0f1c0
canonical developer      a0b7046417a4915fb6e3ccf3f36e127565d0d576
historical merge base    63ae2c3c862f8dc554ad058330e9587d79200cd9
reconciliation merge     329669e29dea9880908994fdcd7936be845970f1
~~~

After reconciliation the feature branch is `0 behind` developer.

## Conflict analysis

The ME1 branch changed 36 files relative to its historical merge base. Current developer changed 83 files in the same interval.

Only two paths overlapped:

~~~text
mk1/runtime/package.json
mk1/runtime/docker-compose.yml
~~~

All other 34 ME1 paths were non-overlapping and were carried forward exactly from the ME1 branch.

## package.json resolution

The current developer package manifest remained authoritative. ME1 added only these scripts:

~~~text
test:managed-entity
migrate:managed-entity
probe:managed-entity
fixture:me1:physical
verify:me1:physical
~~~

Those five scripts were added to the current developer manifest. Existing Meta / CTA / WhatsApp / Facebook Comment scripts were preserved.

## docker-compose.yml resolution

The current developer Compose topology remained authoritative.

ME1 contributed two bounded additions:

1. append `npm run migrate:managed-entity` to the migration chain before Mongo initialization;
2. restore the opt-in `webchat` profile used by the ME1 physical browser gate.

The current developer services and settings were preserved, including:

~~~text
channel-core META_APP_SECRET
channel-core ENGINES_META_PAGE_ROUTES_JSON
WhatsApp direct Meta Cloud API profile
Telegram / Kapso profiles
canonical CTA / worker / persistence services
~~~

## Reproduction method

To repeat this reconciliation safely:

1. identify the historical merge base between `developer` and the feature branch;
2. compare merge-base -> developer and merge-base -> feature;
3. compute the intersection of changed paths;
4. carry non-overlapping feature paths unchanged onto the developer tree;
5. manually merge only the intersecting files;
6. create a merge commit with both the historical feature head and current developer head as parents;
7. require `behind_by=0` against developer;
8. run the exact-head ME1 workflow and the repository regression workflows;
9. do not merge the PR until deterministic CI is green and the declared physical gate truth is unchanged.

## Truth boundary

This receipt proves reconciliation structure only. It does not upgrade the historical ME1 physical certification status. The browser ME1 gate remains a separate acceptance item unless and until explicitly executed and preserved.
