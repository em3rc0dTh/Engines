import { loadRuntimeConfig } from '../../../config/runtime-config.js';
import {
  AttachmentStoreError,
} from '../../../persistence/attachments/attachment-store.types.js';
import { FilesystemAttachmentStore } from '../../../persistence/attachments/filesystem-attachment-store.js';
import type {
  AttachmentStoreActivities,
  CommitAttachmentActivityResult,
  ResolveAttachmentIngressResult,
} from './attachment-store.types.js';

let store: FilesystemAttachmentStore | undefined;

function attachmentStore(): FilesystemAttachmentStore {
  store ??= new FilesystemAttachmentStore(loadRuntimeConfig().attachmentStoreRoot);
  return store;
}

export const attachmentStoreActivities: AttachmentStoreActivities = {
  async resolveAttachmentIngress(input): Promise<ResolveAttachmentIngressResult> {
    try {
      const ingress = await attachmentStore().resolveIngress(input.ingressRef);
      if (!ingress) {
        return {
          kind: 'ATTACHMENT_INGRESS_NOT_FOUND',
          message: `Attachment ingress not found: ${input.ingressRef}`,
        };
      }
      if (ingress.state === 'STAGED' && Date.parse(ingress.expiresAt) <= Date.now()) {
        return {
          kind: 'ATTACHMENT_INGRESS_EXPIRED',
          message: `Attachment ingress expired: ${input.ingressRef}`,
        };
      }
      return { kind: 'RESOLVED', ingress };
    } catch (error) {
      if (error instanceof AttachmentStoreError) {
        if (error.code === 'ATTACHMENT_STORE_UNAVAILABLE') throw error;
        return { kind: error.code, message: error.message } as ResolveAttachmentIngressResult;
      }
      throw error;
    }
  },

  async commitAttachment(input): Promise<CommitAttachmentActivityResult> {
    try {
      return { kind: 'COMMITTED', attachment: await attachmentStore().commit(input) };
    } catch (error) {
      if (error instanceof AttachmentStoreError) {
        if (error.code === 'ATTACHMENT_STORE_UNAVAILABLE') throw error;
        return { kind: error.code, message: error.message } as CommitAttachmentActivityResult;
      }
      throw error;
    }
  },
};

export async function closeAttachmentStoreActivities(): Promise<void> {
  store = undefined;
}
