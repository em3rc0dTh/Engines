import type {
  CommitAttachmentInput,
  CommittedAttachmentMetadata,
} from '../../../persistence/attachments/attachment-store.types.js';

export type CommitAttachmentActivityResult =
  | Readonly<{ kind: 'COMMITTED'; attachment: CommittedAttachmentMetadata }>
  | Readonly<{
      kind:
        | 'ATTACHMENT_INTEGRITY_MISMATCH'
        | 'ATTACHMENT_INGRESS_NOT_FOUND'
        | 'ATTACHMENT_INGRESS_EXPIRED'
        | 'ATTACHMENT_INGRESS_CONFLICT';
      message: string;
    }>;

export type AttachmentStoreActivities = Readonly<{
  commitAttachment(input: CommitAttachmentInput): Promise<CommitAttachmentActivityResult>;
}>;
