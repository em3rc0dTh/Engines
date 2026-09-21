# Integration Registry — TikTok

## Status

```text
deterministic adapter contract  PASS
real provider transport         OPEN
physical CTA journey            OPEN
production access               OPEN
```

TikTok currently exists only as a deterministic provider adapter boundary in the canonical CTA regression.

## Reproduce

```bash
git switch main
cd mk1/runtime
npm ci
npm run check
npm run test:cta:poc
```

The shared CTA suite includes `src/cta/tiktok/*.test.ts`.

## Truth boundary

Do not infer provider connectivity, webhook access, public API approval, real-user delivery or production readiness from deterministic adapter tests.

New provider work starts from `developer` and must return to the canonical line through a bounded PR.
