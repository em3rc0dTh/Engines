import { createHash, randomUUID } from 'node:crypto';
import {
  access,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import {
  AttachmentStoreError,
  MK0_ATTACHMENT_ALLOWED_MEDIA_TYPES,
  MK0_ATTACHMENT_MAX_SINGLE_BYTES,
  MK0_ATTACHMENT_STAGE_TTL_MS,
  type AttachmentReconciliationCandidate,
  type AttachmentStorePort,
  type CommitAttachmentInput,
  type CommittedAttachmentMetadata,
  type StageAttachmentInput,
  type StagedAttachmentMetadata,
} from './attachment-store.types.js';

function sha256(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function cleanIngressRef(value: string): string {
  const trimmed = value.trim();
  if (!/^ing_[A-Za-z0-9._-]+$/.test(trimmed)) {
    throw new AttachmentStoreError('ATTACHMENT_INGRESS_CONFLICT', 'invalid ingressRef format');
  }
  return trimmed;
}

function lowerSha(value: string): string {
  return value.trim().toLowerCase();
}

function assertSha(value: string): string {
  const digest = lowerSha(value);
  if (!/^[a-f0-9]{64}$/.test(digest)) {
    throw new AttachmentStoreError('ATTACHMENT_INTEGRITY_MISMATCH', 'expected SHA-256 is invalid');
  }
  return digest;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function atomicWrite(path: string, bytes: Uint8Array | string): Promise<void> {
  const temporary = `${path}.tmp-${process.pid}-${randomUUID()}`;
  await writeFile(temporary, bytes, { flag: 'wx' });
  await rename(temporary, path);
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}

async function atomicJson(path: string, value: unknown): Promise<void> {
  await atomicWrite(path, `${JSON.stringify(value, null, 2)}\n`);
}

export class FilesystemAttachmentStore implements AttachmentStorePort {
  constructor(
    readonly root: string,
    private readonly ttlMs = MK0_ATTACHMENT_STAGE_TTL_MS,
  ) {}

  private ingressDir(ingressRef: string): string {
    return join(this.root, 'ingress', ingressRef);
  }

  private ingressMetadataPath(ingressRef: string): string {
    return join(this.ingressDir(ingressRef), 'metadata.json');
  }

  private ingressPayloadPath(ingressRef: string): string {
    return join(this.ingressDir(ingressRef), 'payload.bin');
  }

  private committedPath(attachmentId: string): string {
    return join(this.root, 'committed', `${attachmentId}.json`);
  }

  private objectPath(digest: string): string {
    return join(this.root, 'objects', 'sha256', digest);
  }

  private async ensureLayout(): Promise<void> {
    await Promise.all([
      mkdir(join(this.root, 'ingress'), { recursive: true }),
      mkdir(join(this.root, 'objects', 'sha256'), { recursive: true }),
      mkdir(join(this.root, 'committed'), { recursive: true }),
      mkdir(join(this.root, 'quarantine-or-orphans'), { recursive: true }),
    ]);
  }

  async stage(input: StageAttachmentInput): Promise<StagedAttachmentMetadata> {
    await this.ensureLayout();
    const bytes = Buffer.from(input.bytes);
    if (bytes.byteLength > MK0_ATTACHMENT_MAX_SINGLE_BYTES) {
      throw new AttachmentStoreError(
        'ATTACHMENT_TOO_LARGE',
        `single attachment exceeds ${MK0_ATTACHMENT_MAX_SINGLE_BYTES} bytes`,
      );
    }

    const mediaType = input.mediaType.trim().toLowerCase();
    if (!(MK0_ATTACHMENT_ALLOWED_MEDIA_TYPES as readonly string[]).includes(mediaType)) {
      throw new AttachmentStoreError('ATTACHMENT_MEDIA_TYPE_NOT_ALLOWED', mediaType);
    }

    const actualSha256 = sha256(bytes);
    const expectedSha256 = input.expectedSha256 ? assertSha(input.expectedSha256) : actualSha256;
    if (expectedSha256 !== actualSha256) {
      throw new AttachmentStoreError(
        'ATTACHMENT_INTEGRITY_MISMATCH',
        `staged bytes sha256=${actualSha256} expected=${expectedSha256}`,
      );
    }

    const ingressRef = cleanIngressRef(input.ingressRef ?? `ing_${randomUUID()}`);
    const ingressDir = this.ingressDir(ingressRef);
    const metadataPath = this.ingressMetadataPath(ingressRef);
    const payloadPath = this.ingressPayloadPath(ingressRef);

    if (await exists(metadataPath)) {
      const existing = await readJson<StagedAttachmentMetadata>(metadataPath);
      const same =
        existing.mediaType === mediaType &&
        existing.byteLength === bytes.byteLength &&
        existing.sha256 === actualSha256 &&
        existing.expectedSha256 === expectedSha256;
      if (!same) {
        throw new AttachmentStoreError(
          'ATTACHMENT_INGRESS_CONFLICT',
          `ingressRef ${ingressRef} already exists with different material`,
        );
      }
      return existing;
    }

    await mkdir(ingressDir, { recursive: false });
    const now = new Date();
    const metadata: StagedAttachmentMetadata = {
      ingressRef,
      state: 'STAGED',
      mediaType,
      byteLength: bytes.byteLength,
      sha256: actualSha256,
      expectedSha256,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.ttlMs).toISOString(),
      ...(input.displayName?.trim() ? { displayName: input.displayName.trim() } : {}),
    };

    try {
      await atomicWrite(payloadPath, bytes);
      await atomicJson(metadataPath, metadata);
      return metadata;
    } catch (error) {
      await rm(ingressDir, { recursive: true, force: true });
      throw error;
    }
  }

  async resolveIngress(ingressRefInput: string): Promise<StagedAttachmentMetadata | undefined> {
    await this.ensureLayout();
    const ingressRef = cleanIngressRef(ingressRefInput);
    const metadataPath = this.ingressMetadataPath(ingressRef);
    if (!(await exists(metadataPath))) return undefined;
    return readJson<StagedAttachmentMetadata>(metadataPath);
  }

  async commit(input: CommitAttachmentInput): Promise<CommittedAttachmentMetadata> {
    await this.ensureLayout();
    const ingressRef = cleanIngressRef(input.ingressRef);
    const metadata = await this.resolveIngress(ingressRef);
    if (!metadata) {
      throw new AttachmentStoreError('ATTACHMENT_INGRESS_NOT_FOUND', ingressRef);
    }

    if (metadata.state === 'COMMITTED' && metadata.attachmentId) {
      const committed = await this.getCommitted(metadata.attachmentId);
      if (!committed) {
        throw new AttachmentStoreError(
          'ATTACHMENT_STORE_UNAVAILABLE',
          `committed ingress ${ingressRef} is missing logical metadata`,
        );
      }
      this.assertExpectedIntegrity(committed, input);
      return committed;
    }

    if (Date.parse(metadata.expiresAt) <= Date.now()) {
      throw new AttachmentStoreError('ATTACHMENT_INGRESS_EXPIRED', ingressRef);
    }

    const payload = await readFile(this.ingressPayloadPath(ingressRef));
    const actualSha256 = sha256(payload);
    const actualLength = payload.byteLength;
    if (actualSha256 !== metadata.sha256 || actualLength !== metadata.byteLength) {
      throw new AttachmentStoreError(
        'ATTACHMENT_INTEGRITY_MISMATCH',
        `staged ingress ${ingressRef} changed after stage`,
      );
    }

    const attachmentId = `att_${sha256(`mk0:${ingressRef}`).slice(0, 32)}`;
    const committedAt = new Date().toISOString();
    const committed: CommittedAttachmentMetadata = {
      attachmentId,
      ingressRef,
      mediaType: metadata.mediaType,
      byteLength: metadata.byteLength,
      sha256: metadata.sha256,
      committedAt,
      ...(metadata.displayName ? { displayName: metadata.displayName } : {}),
    };
    this.assertExpectedIntegrity(committed, input);

    const objectPath = this.objectPath(metadata.sha256);
    if (!(await exists(objectPath))) {
      await atomicWrite(objectPath, payload);
    } else {
      const objectBytes = await readFile(objectPath);
      if (sha256(objectBytes) !== metadata.sha256 || objectBytes.byteLength !== metadata.byteLength) {
        throw new AttachmentStoreError(
          'ATTACHMENT_INTEGRITY_MISMATCH',
          `content-addressed object ${metadata.sha256} is corrupt`,
        );
      }
    }

    const committedPath = this.committedPath(attachmentId);
    if (await exists(committedPath)) {
      const existing = await readJson<CommittedAttachmentMetadata>(committedPath);
      this.assertSameCommitted(existing, committed);
      return existing;
    }

    await atomicJson(committedPath, committed);
    await atomicJson(this.ingressMetadataPath(ingressRef), {
      ...metadata,
      state: 'COMMITTED',
      attachmentId,
      committedAt,
    } satisfies StagedAttachmentMetadata);
    return committed;
  }

  private assertExpectedIntegrity(
    committed: CommittedAttachmentMetadata,
    input: CommitAttachmentInput,
  ): void {
    if (input.expectedSha256 && committed.sha256 !== assertSha(input.expectedSha256)) {
      throw new AttachmentStoreError(
        'ATTACHMENT_INTEGRITY_MISMATCH',
        `attachment ${committed.attachmentId} SHA-256 differs from Workflow expectation`,
      );
    }
    if (
      input.expectedByteLength !== undefined &&
      committed.byteLength !== input.expectedByteLength
    ) {
      throw new AttachmentStoreError(
        'ATTACHMENT_INTEGRITY_MISMATCH',
        `attachment ${committed.attachmentId} length differs from Workflow expectation`,
      );
    }
    if (
      input.expectedMediaType &&
      committed.mediaType !== input.expectedMediaType.trim().toLowerCase()
    ) {
      throw new AttachmentStoreError(
        'ATTACHMENT_INTEGRITY_MISMATCH',
        `attachment ${committed.attachmentId} media type differs from Workflow expectation`,
      );
    }
  }

  private assertSameCommitted(
    left: CommittedAttachmentMetadata,
    right: CommittedAttachmentMetadata,
  ): void {
    if (
      left.attachmentId !== right.attachmentId ||
      left.ingressRef !== right.ingressRef ||
      left.mediaType !== right.mediaType ||
      left.byteLength !== right.byteLength ||
      left.sha256 !== right.sha256
    ) {
      throw new AttachmentStoreError(
        'ATTACHMENT_INGRESS_CONFLICT',
        `logical attachment ${right.attachmentId} already exists with different material`,
      );
    }
  }

  async getCommitted(attachmentId: string): Promise<CommittedAttachmentMetadata | undefined> {
    await this.ensureLayout();
    const path = this.committedPath(attachmentId.trim());
    if (!(await exists(path))) return undefined;
    return readJson<CommittedAttachmentMetadata>(path);
  }

  async readCommitted(attachmentId: string): Promise<Uint8Array> {
    const metadata = await this.getCommitted(attachmentId);
    if (!metadata) {
      throw new AttachmentStoreError('ATTACHMENT_INGRESS_NOT_FOUND', attachmentId);
    }
    const bytes = await readFile(this.objectPath(metadata.sha256));
    if (bytes.byteLength !== metadata.byteLength || sha256(bytes) !== metadata.sha256) {
      throw new AttachmentStoreError(
        'ATTACHMENT_INTEGRITY_MISMATCH',
        `committed object ${attachmentId} failed read verification`,
      );
    }
    return bytes;
  }

  async expireStaged(now = new Date()): Promise<readonly string[]> {
    await this.ensureLayout();
    const expired: string[] = [];
    for (const ingressRef of await readdir(join(this.root, 'ingress'))) {
      const metadata = await this.resolveIngress(ingressRef);
      if (!metadata || metadata.state !== 'STAGED') continue;
      if (Date.parse(metadata.expiresAt) > now.getTime()) continue;
      await rm(this.ingressDir(ingressRef), { recursive: true, force: true });
      expired.push(ingressRef);
    }
    return expired.sort();
  }

  async listReconciliationCandidates(
    now = new Date(),
  ): Promise<readonly AttachmentReconciliationCandidate[]> {
    await this.ensureLayout();
    const candidates: AttachmentReconciliationCandidate[] = [];
    for (const ingressRef of await readdir(join(this.root, 'ingress'))) {
      const metadataPath = this.ingressMetadataPath(ingressRef);
      if (!(await exists(metadataPath))) {
        candidates.push({ ingressRef, reason: 'MISSING_METADATA' });
        continue;
      }
      const metadata = await readJson<StagedAttachmentMetadata>(metadataPath);
      if (metadata.state === 'STAGED' && Date.parse(metadata.expiresAt) <= now.getTime()) {
        candidates.push({ ingressRef, reason: 'EXPIRED_STAGED' });
      }
      if (
        metadata.state === 'COMMITTED' &&
        metadata.attachmentId &&
        !(await exists(this.committedPath(metadata.attachmentId)))
      ) {
        candidates.push({ ingressRef, reason: 'COMMITTED_METADATA_MISSING' });
      }
    }
    return candidates.sort((a, b) => a.ingressRef.localeCompare(b.ingressRef));
  }
}
