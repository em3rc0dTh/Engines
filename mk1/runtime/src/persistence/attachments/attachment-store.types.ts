export const MK0_ATTACHMENT_MAX_COUNT = 4;
export const MK0_ATTACHMENT_MAX_SINGLE_BYTES = 1024 * 1024;
export const MK0_ATTACHMENT_MAX_TOTAL_BYTES = 2 * 1024 * 1024;
export const MK0_ATTACHMENT_STAGE_TTL_MS = 15 * 60 * 1000;
export const MK0_ATTACHMENT_ALLOWED_MEDIA_TYPES = ['image/png', 'text/plain'] as const;

export type Mk0AttachmentMediaType = (typeof MK0_ATTACHMENT_ALLOWED_MEDIA_TYPES)[number];

export type AttachmentIngressState = 'STAGED' | 'COMMITTED';

export type StageAttachmentInput = Readonly<{
  bytes: Uint8Array;
  mediaType: string;
  expectedSha256?: string;
  displayName?: string;
  ingressRef?: string;
}>;

export type StagedAttachmentMetadata = Readonly<{
  ingressRef: string;
  state: AttachmentIngressState;
  mediaType: string;
  byteLength: number;
  sha256: string;
  expectedSha256: string;
  createdAt: string;
  expiresAt: string;
  displayName?: string;
  attachmentId?: string;
  committedAt?: string;
}>;

export type CommitAttachmentInput = Readonly<{
  ingressRef: string;
  expectedSha256?: string;
  expectedByteLength?: number;
  expectedMediaType?: string;
}>;

export type CommittedAttachmentMetadata = Readonly<{
  attachmentId: string;
  ingressRef: string;
  mediaType: string;
  byteLength: number;
  sha256: string;
  committedAt: string;
  displayName?: string;
}>;

export type AttachmentReconciliationCandidate = Readonly<{
  ingressRef: string;
  reason: 'MISSING_METADATA' | 'EXPIRED_STAGED' | 'COMMITTED_METADATA_MISSING';
}>;

export type AttachmentStorePort = Readonly<{
  stage(input: StageAttachmentInput): Promise<StagedAttachmentMetadata>;
  resolveIngress(ingressRef: string): Promise<StagedAttachmentMetadata | undefined>;
  commit(input: CommitAttachmentInput): Promise<CommittedAttachmentMetadata>;
  getCommitted(attachmentId: string): Promise<CommittedAttachmentMetadata | undefined>;
  readCommitted(attachmentId: string): Promise<Uint8Array>;
  expireStaged(now?: Date): Promise<readonly string[]>;
  listReconciliationCandidates(now?: Date): Promise<readonly AttachmentReconciliationCandidate[]>;
}>;

export type AttachmentStoreFailureCode =
  | 'ATTACHMENT_STORE_UNAVAILABLE'
  | 'ATTACHMENT_INTEGRITY_MISMATCH'
  | 'ATTACHMENT_INGRESS_CONFLICT'
  | 'ATTACHMENT_INGRESS_NOT_FOUND'
  | 'ATTACHMENT_INGRESS_EXPIRED'
  | 'ATTACHMENT_MEDIA_TYPE_NOT_ALLOWED'
  | 'ATTACHMENT_TOO_LARGE';

export class AttachmentStoreError extends Error {
  constructor(
    readonly code: AttachmentStoreFailureCode,
    message: string,
  ) {
    super(`${code}:${message}`);
    this.name = 'AttachmentStoreError';
  }
}
