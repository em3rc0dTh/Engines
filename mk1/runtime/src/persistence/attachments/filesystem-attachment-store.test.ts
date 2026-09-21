import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  AttachmentStoreError,
  MK0_ATTACHMENT_MAX_SINGLE_BYTES,
} from './attachment-store.types.js';
import { FilesystemAttachmentStore } from './filesystem-attachment-store.js';

const PNG_SHA = '248c43a8627c6db8f95626beaca3b056bcfafcd036a4344dd3ed14e1e704da84';
const TXT_SHA = 'c4de8a6ee133dfc935ccb27071170ea692d1261f30cb18cd35269a1d09cf1609';

async function fixture(name: string): Promise<Buffer> {
  return readFile(
    fileURLToPath(new URL(`../../../../golden-dataset/fixtures/${name}`, import.meta.url)),
  );
}

async function withStore(
  run: (store: FilesystemAttachmentStore, root: string) => Promise<void>,
  ttlMs?: number,
): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), 'engines-mk0-b7-'));
  try {
    await run(new FilesystemAttachmentStore(root, ttlMs), root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('B7 stages and commits exact fixture bytes with retry-stable logical identity', async () => {
  await withStore(async (store, root) => {
    const bytes = await fixture('synthetic-id-front-v1.png');
    const staged = await store.stage({
      ingressRef: 'ing_test_png',
      bytes,
      mediaType: 'image/png',
      expectedSha256: PNG_SHA,
      displayName: 'Synthetic ID front',
    });

    assert.equal(staged.byteLength, 75);
    assert.equal(staged.sha256, PNG_SHA);
    assert.equal(staged.state, 'STAGED');

    const first = await store.commit({ ingressRef: staged.ingressRef, expectedSha256: PNG_SHA });
    const retry = await store.commit({ ingressRef: staged.ingressRef, expectedSha256: PNG_SHA });
    assert.equal(retry.attachmentId, first.attachmentId);
    assert.deepEqual(Buffer.from(await store.readCommitted(first.attachmentId)), bytes);

    const objectFiles = await readdir(join(root, 'objects', 'sha256'));
    assert.deepEqual(objectFiles, [PNG_SHA]);
  });
});

test('B7 keeps logical attachment identity separate from content identity', async () => {
  await withStore(async (store, root) => {
    const bytes = await fixture('synthetic-id-front-v1.png');
    await store.stage({ ingressRef: 'ing_same_bytes_a', bytes, mediaType: 'image/png', expectedSha256: PNG_SHA });
    await store.stage({ ingressRef: 'ing_same_bytes_b', bytes, mediaType: 'image/png', expectedSha256: PNG_SHA });
    const a = await store.commit({ ingressRef: 'ing_same_bytes_a' });
    const b = await store.commit({ ingressRef: 'ing_same_bytes_b' });

    assert.notEqual(a.attachmentId, b.attachmentId);
    assert.equal(a.sha256, b.sha256);
    assert.equal((await readdir(join(root, 'objects', 'sha256'))).length, 1);
  });
});

test('B7 rejects materially different reuse of the same ingressRef', async () => {
  await withStore(async (store) => {
    const png = await fixture('synthetic-id-front-v1.png');
    const text = await fixture('synthetic-supporting-document-v1.txt');
    await store.stage({ ingressRef: 'ing_conflict', bytes: png, mediaType: 'image/png', expectedSha256: PNG_SHA });

    await assert.rejects(
      () => store.stage({ ingressRef: 'ing_conflict', bytes: text, mediaType: 'text/plain', expectedSha256: TXT_SHA }),
      (error: unknown) =>
        error instanceof AttachmentStoreError && error.code === 'ATTACHMENT_INGRESS_CONFLICT',
    );
  });
});

test('B7 detects staged-byte corruption at commit', async () => {
  await withStore(async (store, root) => {
    const bytes = await fixture('synthetic-id-front-v1.png');
    await store.stage({ ingressRef: 'ing_corrupt', bytes, mediaType: 'image/png', expectedSha256: PNG_SHA });
    await writeFile(join(root, 'ingress', 'ing_corrupt', 'payload.bin'), Buffer.from('corrupt'));

    await assert.rejects(
      () => store.commit({ ingressRef: 'ing_corrupt' }),
      (error: unknown) =>
        error instanceof AttachmentStoreError && error.code === 'ATTACHMENT_INTEGRITY_MISMATCH',
    );
  });
});

test('B7 exposes expired staged ingress as reconciliation work and can expire it', async () => {
  await withStore(async (store) => {
    const text = await fixture('synthetic-supporting-document-v1.txt');
    await store.stage({ ingressRef: 'ing_expired', bytes: text, mediaType: 'text/plain', expectedSha256: TXT_SHA });
    await new Promise((resolve) => setTimeout(resolve, 5));

    const candidates = await store.listReconciliationCandidates();
    assert.deepEqual(candidates, [{ ingressRef: 'ing_expired', reason: 'EXPIRED_STAGED' }]);
    assert.deepEqual(await store.expireStaged(), ['ing_expired']);
    assert.equal(await store.resolveIngress('ing_expired'), undefined);
  }, 1);
});

test('B7 enforces the laboratory single-attachment limit at ingress', async () => {
  await withStore(async (store) => {
    await assert.rejects(
      () =>
        store.stage({
          ingressRef: 'ing_too_large',
          bytes: Buffer.alloc(MK0_ATTACHMENT_MAX_SINGLE_BYTES + 1),
          mediaType: 'text/plain',
        }),
      (error: unknown) =>
        error instanceof AttachmentStoreError && error.code === 'ATTACHMENT_TOO_LARGE',
    );
  });
});
