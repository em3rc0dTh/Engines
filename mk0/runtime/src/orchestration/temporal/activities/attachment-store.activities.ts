import { loadRuntimeConfig } from '../../../config/runtime-config.js';
import {
  AttachmentStoreError,
} from '../../../persistence/attachments/attachment-store.types.js';
import { FilesystemAttachmentStore } from '../../../persistence/attachments/filesystem-attachment-store.js';
import type {
  AttachmentStoreActivities,
  CommitAttachmentActivityResult,
} from './attachment-store.types.js';

let store: FilesystemAttachmentStore | undefined;

function attachmentStore(): FilesystemAttachmentStore {
  store ??= new FilesystemAttachmentStore(loadRuntimeConfig().attachmentStoreRoot);
  return store;
}

export const attachmentStoreActivities: AttachmentStoreActivities = {
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
