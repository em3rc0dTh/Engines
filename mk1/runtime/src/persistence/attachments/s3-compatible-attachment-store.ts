import { createHash, createHmac, randomUUID } from 'node:crypto';
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

export type S3CompatibleAttachmentStoreConfig = Readonly<{
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  ttlMs?: number;
}>;

function sha256(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function hmac(key: Uint8Array | string, value: string): Buffer {
  return createHmac('sha256', key).update(value, 'utf8').digest();
}

function awsEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodeKey(key: string): string {
  return key.split('/').map(awsEncode).join('/');
}

function canonicalQuery(query: Readonly<Record<string, string>>): string {
  return Object.entries(query)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${awsEncode(key)}=${awsEncode(value)}`)
    .join('&');
}

function cleanIngressRef(value: string): string {
  const trimmed = value.trim();
  if (!/^ing_[A-Za-z0-9._-]+$/.test(trimmed)) {
    throw new AttachmentStoreError('ATTACHMENT_INGRESS_CONFLICT', 'invalid ingressRef format');
  }
  return trimmed;
}

function assertSha(value: string): string {
  const digest = value.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(digest)) {
    throw new AttachmentStoreError('ATTACHMENT_INTEGRITY_MISMATCH', 'expected SHA-256 is invalid');
  }
  return digest;
}

function unescapeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export class S3CompatibleAttachmentStore implements AttachmentStorePort {
  private readonly endpoint: URL;
  private readonly ttlMs: number;

  constructor(private readonly config: S3CompatibleAttachmentStoreConfig) {
    this.endpoint = new URL(config.endpoint.endsWith('/') ? config.endpoint : `${config.endpoint}/`);
    this.ttlMs = config.ttlMs ?? MK0_ATTACHMENT_STAGE_TTL_MS;
  }

  private ingressMetadataKey(ingressRef: string): string {
    return `ingress/${ingressRef}/metadata.json`;
  }

  private ingressPayloadKey(ingressRef: string): string {
    return `ingress/${ingressRef}/payload.bin`;
  }

  private committedKey(attachmentId: string): string {
    return `committed/${attachmentId}.json`;
  }

  private objectKey(digest: string): string {
    return `objects/sha256/${digest}`;
  }

  private async request(
    method: 'GET' | 'PUT' | 'HEAD' | 'DELETE',
    key: string | undefined,
    options: Readonly<{
      query?: Readonly<Record<string, string>>;
      body?: Uint8Array | string;
      contentType?: string;
      allow404?: boolean;
    }> = {},
  ): Promise<Response> {
    const query = options.query ?? {};
    const path = `/${awsEncode(this.config.bucket)}${key ? `/${encodeKey(key)}` : ''}`;
    const queryString = canonicalQuery(query);
    const url = new URL(this.endpoint);
    url.pathname = path;
    url.search = queryString;

    const body = options.body === undefined
      ? new Uint8Array()
      : typeof options.body === 'string'
        ? Buffer.from(options.body, 'utf8')
        : Buffer.from(options.body);
    const payloadHash = sha256(body);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const date = amzDate.slice(0, 8);
    const host = url.host;
    const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    const canonicalRequest = [
      method,
      path,
      queryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');
    const scope = `${date}/${this.config.region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      scope,
      sha256(canonicalRequest),
    ].join('\n');
    const dateKey = hmac(`AWS4${this.config.secretAccessKey}`, date);
    const regionKey = hmac(dateKey, this.config.region);
    const serviceKey = hmac(regionKey, 's3');
    const signingKey = hmac(serviceKey, 'aws4_request');
    const signature = createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');
    const headers: Record<string, string> = {
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      authorization: `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    };
    if (options.contentType) headers['content-type'] = options.contentType;

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        ...(method === 'PUT' ? { body } : {}),
      });
    } catch (error) {
      throw new AttachmentStoreError(
        'ATTACHMENT_STORE_UNAVAILABLE',
        error instanceof Error ? error.message : String(error),
      );
    }
    if (response.status === 404 && options.allow404) return response;
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new AttachmentStoreError(
        'ATTACHMENT_STORE_UNAVAILABLE',
        `S3 ${method} ${key ?? this.config.bucket} failed ${response.status}: ${detail}`,
      );
    }
    return response;
  }

  private async exists(key: string): Promise<boolean> {
    return (await this.request('HEAD', key, { allow404: true })).status !== 404;
  }

  private async readJson<T>(key: string): Promise<T | undefined> {
    const response = await this.request('GET', key, { allow404: true });
    if (response.status === 404) return undefined;
    return JSON.parse(await response.text()) as T;
  }

  private async putJson(key: string, value: unknown): Promise<void> {
    await this.request('PUT', key, {
      body: `${JSON.stringify(value, null, 2)}\n`,
      contentType: 'application/json',
    });
  }

  private async listKeys(prefix: string): Promise<readonly string[]> {
    const keys: string[] = [];
    let continuationToken: string | undefined;
    do {
      const query: Record<string, string> = { 'list-type': '2', prefix };
      if (continuationToken) query['continuation-token'] = continuationToken;
      const response = await this.request('GET', undefined, { query });
      const xml = await response.text();
      for (const match of xml.matchAll(/<Key>([\s\S]*?)<\/Key>/g)) keys.push(unescapeXml(match[1]!));
      continuationToken = /<IsTruncated>true<\/IsTruncated>/.test(xml)
        ? unescapeXml(xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1] ?? '') || undefined
        : undefined;
    } while (continuationToken);
    return keys.sort();
  }

  async stage(input: StageAttachmentInput): Promise<StagedAttachmentMetadata> {
    const bytes = Buffer.from(input.bytes);
    if (bytes.byteLength > MK0_ATTACHMENT_MAX_SINGLE_BYTES) {
      throw new AttachmentStoreError('ATTACHMENT_TOO_LARGE', `single attachment exceeds ${MK0_ATTACHMENT_MAX_SINGLE_BYTES} bytes`);
    }
    const mediaType = input.mediaType.trim().toLowerCase();
    if (!(MK0_ATTACHMENT_ALLOWED_MEDIA_TYPES as readonly string[]).includes(mediaType)) {
      throw new AttachmentStoreError('ATTACHMENT_MEDIA_TYPE_NOT_ALLOWED', mediaType);
    }
    const actualSha256 = sha256(bytes);
    const expectedSha256 = input.expectedSha256 ? assertSha(input.expectedSha256) : actualSha256;
    if (actualSha256 !== expectedSha256) {
      throw new AttachmentStoreError('ATTACHMENT_INTEGRITY_MISMATCH', `staged bytes sha256=${actualSha256} expected=${expectedSha256}`);
    }
    const ingressRef = cleanIngressRef(input.ingressRef ?? `ing_${randomUUID()}`);
    const existing = await this.resolveIngress(ingressRef);
    if (existing) {
      const same = existing.mediaType === mediaType
        && existing.byteLength === bytes.byteLength
        && existing.sha256 === actualSha256
        && existing.expectedSha256 === expectedSha256;
      if (!same) throw new AttachmentStoreError('ATTACHMENT_INGRESS_CONFLICT', `ingressRef ${ingressRef} already exists with different material`);
      return existing;
    }
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
    await this.request('PUT', this.ingressPayloadKey(ingressRef), { body: bytes, contentType: mediaType });
    await this.putJson(this.ingressMetadataKey(ingressRef), metadata);
    return metadata;
  }

  async resolveIngress(ingressRefInput: string): Promise<StagedAttachmentMetadata | undefined> {
    return this.readJson<StagedAttachmentMetadata>(this.ingressMetadataKey(cleanIngressRef(ingressRefInput)));
  }

  async commit(input: CommitAttachmentInput): Promise<CommittedAttachmentMetadata> {
    const ingressRef = cleanIngressRef(input.ingressRef);
    const metadata = await this.resolveIngress(ingressRef);
    if (!metadata) throw new AttachmentStoreError('ATTACHMENT_INGRESS_NOT_FOUND', ingressRef);
    if (metadata.state === 'COMMITTED' && metadata.attachmentId) {
      const committed = await this.getCommitted(metadata.attachmentId);
      if (!committed) throw new AttachmentStoreError('ATTACHMENT_STORE_UNAVAILABLE', `committed ingress ${ingressRef} is missing logical metadata`);
      this.assertExpectedIntegrity(committed, input);
      return committed;
    }
    if (Date.parse(metadata.expiresAt) <= Date.now()) {
      throw new AttachmentStoreError('ATTACHMENT_INGRESS_EXPIRED', ingressRef);
    }
    const payloadResponse = await this.request('GET', this.ingressPayloadKey(ingressRef));
    const payload = Buffer.from(await payloadResponse.arrayBuffer());
    if (payload.byteLength !== metadata.byteLength || sha256(payload) !== metadata.sha256) {
      throw new AttachmentStoreError('ATTACHMENT_INTEGRITY_MISMATCH', `staged ingress ${ingressRef} changed after stage`);
    }
    const attachmentId = `att_${sha256(`mk0:${ingressRef}`).slice(0, 32)}`;
    const committed: CommittedAttachmentMetadata = {
      attachmentId,
      ingressRef,
      mediaType: metadata.mediaType,
      byteLength: metadata.byteLength,
      sha256: metadata.sha256,
      committedAt: new Date().toISOString(),
      ...(metadata.displayName ? { displayName: metadata.displayName } : {}),
    };
    this.assertExpectedIntegrity(committed, input);
    const objectKey = this.objectKey(metadata.sha256);
    if (!(await this.exists(objectKey))) {
      await this.request('PUT', objectKey, { body: payload, contentType: metadata.mediaType });
    } else {
      const object = Buffer.from(await (await this.request('GET', objectKey)).arrayBuffer());
      if (object.byteLength !== metadata.byteLength || sha256(object) !== metadata.sha256) {
        throw new AttachmentStoreError('ATTACHMENT_INTEGRITY_MISMATCH', `content-addressed object ${metadata.sha256} is corrupt`);
      }
    }
    const existingCommitted = await this.getCommitted(attachmentId);
    if (existingCommitted) {
      this.assertSameCommitted(existingCommitted, committed);
      return existingCommitted;
    }
    await this.putJson(this.committedKey(attachmentId), committed);
    await this.putJson(this.ingressMetadataKey(ingressRef), {
      ...metadata,
      state: 'COMMITTED',
      attachmentId,
      committedAt: committed.committedAt,
    } satisfies StagedAttachmentMetadata);
    return committed;
  }

  private assertExpectedIntegrity(committed: CommittedAttachmentMetadata, input: CommitAttachmentInput): void {
    if (input.expectedSha256 && committed.sha256 !== assertSha(input.expectedSha256)) {
      throw new AttachmentStoreError('ATTACHMENT_INTEGRITY_MISMATCH', `attachment ${committed.attachmentId} SHA-256 differs from Workflow expectation`);
    }
    if (input.expectedByteLength !== undefined && committed.byteLength !== input.expectedByteLength) {
      throw new AttachmentStoreError('ATTACHMENT_INTEGRITY_MISMATCH', `attachment ${committed.attachmentId} length differs from Workflow expectation`);
    }
    if (input.expectedMediaType && committed.mediaType !== input.expectedMediaType.trim().toLowerCase()) {
      throw new AttachmentStoreError('ATTACHMENT_INTEGRITY_MISMATCH', `attachment ${committed.attachmentId} media type differs from Workflow expectation`);
    }
  }

  private assertSameCommitted(left: CommittedAttachmentMetadata, right: CommittedAttachmentMetadata): void {
    if (
      left.attachmentId !== right.attachmentId
      || left.ingressRef !== right.ingressRef
      || left.mediaType !== right.mediaType
      || left.byteLength !== right.byteLength
      || left.sha256 !== right.sha256
    ) {
      throw new AttachmentStoreError('ATTACHMENT_INGRESS_CONFLICT', `logical attachment ${right.attachmentId} already exists with different material`);
    }
  }

  async getCommitted(attachmentId: string): Promise<CommittedAttachmentMetadata | undefined> {
    return this.readJson<CommittedAttachmentMetadata>(this.committedKey(attachmentId.trim()));
  }

  async readCommitted(attachmentId: string): Promise<Uint8Array> {
    const metadata = await this.getCommitted(attachmentId);
    if (!metadata) throw new AttachmentStoreError('ATTACHMENT_INGRESS_NOT_FOUND', attachmentId);
    const bytes = Buffer.from(await (await this.request('GET', this.objectKey(metadata.sha256))).arrayBuffer());
    if (bytes.byteLength !== metadata.byteLength || sha256(bytes) !== metadata.sha256) {
      throw new AttachmentStoreError('ATTACHMENT_INTEGRITY_MISMATCH', `committed object ${attachmentId} failed read verification`);
    }
    return bytes;
  }

  async expireStaged(now = new Date()): Promise<readonly string[]> {
    const keys = await this.listKeys('ingress/');
    const metadataKeys = keys.filter((key) => key.endsWith('/metadata.json'));
    const expired: string[] = [];
    for (const key of metadataKeys) {
      const metadata = await this.readJson<StagedAttachmentMetadata>(key);
      if (!metadata || metadata.state !== 'STAGED' || Date.parse(metadata.expiresAt) > now.getTime()) continue;
      await this.request('DELETE', this.ingressPayloadKey(metadata.ingressRef));
      await this.request('DELETE', key);
      expired.push(metadata.ingressRef);
    }
    return expired.sort();
  }

  async listReconciliationCandidates(now = new Date()): Promise<readonly AttachmentReconciliationCandidate[]> {
    const keys = await this.listKeys('ingress/');
    const ingressRefs = new Set<string>();
    for (const key of keys) {
      const match = /^ingress\/([^/]+)\//.exec(key);
      if (match) ingressRefs.add(match[1]!);
    }
    const candidates: AttachmentReconciliationCandidate[] = [];
    for (const ingressRef of [...ingressRefs].sort()) {
      const metadata = await this.resolveIngress(ingressRef);
      if (!metadata) {
        candidates.push({ ingressRef, reason: 'MISSING_METADATA' });
        continue;
      }
      if (metadata.state === 'STAGED' && Date.parse(metadata.expiresAt) <= now.getTime()) {
        candidates.push({ ingressRef, reason: 'EXPIRED_STAGED' });
      }
      if (metadata.state === 'COMMITTED' && metadata.attachmentId && !(await this.exists(this.committedKey(metadata.attachmentId)))) {
        candidates.push({ ingressRef, reason: 'COMMITTED_METADATA_MISSING' });
      }
    }
    return candidates;
  }
}
