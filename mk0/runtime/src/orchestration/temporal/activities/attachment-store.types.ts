import type {
  CommitAttachmentInput,
  CommittedAttachmentMetadata,
  StagedAttachmentMetadata,
} from '../../../persistence/attachments/attachment-store.types.js';

export type AttachmentActivityFailureKind =
  | 'ATTACHMENT_INTEGRITY_MISMATCH'
  | 'ATTACHMENT_INGRESS_NOT_FOUND'
  | 'ATTACHMENT_INGRESS_EXPIRED'
  | 'ATTACHMENT_INGRESS_CONFLICT';

export type ResolveAttachmentIngressResult =
  | Readonly<{ kind: 'RESOLVED'; ingress: StagedAttachmentMetadata }>
  | Readonly<{ kind: AttachmentActivityFailureKind; message: string }>;

export type CommitAttachmentActivityResult =
  | Readonly<{ kind: 'COMMITTED'; attachment: CommittedAttachmentMetadata }>
  | Readonly<{ kind: AttachmentActivityFailureKind; message: string }>;

export type AttachmentStoreActivities = Readonly<{
  resolveAttachmentIngress(input: Readonly<{ ingressRef: string }>): Promise<ResolveAttachmentIngressResult>;
  commitAttachment(input: CommitAttachmentInput): Promise<CommitAttachmentActivityResult>;
}>;
