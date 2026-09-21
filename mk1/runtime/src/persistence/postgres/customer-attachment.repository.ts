import { Pool } from 'pg';
import { loadRuntimeConfig } from '../../config/runtime-config.js';
import type { CommittedAttachmentMetadata } from '../attachments/attachment-store.types.js';

let pool: Pool | undefined;

function db(): Pool {
  pool ??= new Pool({ connectionString: loadRuntimeConfig().postgresUrl, max: 4 });
  return pool;
}

export type LinkCustomerAttachmentInput = Readonly<{
  customerId: string;
  attachment: CommittedAttachmentMetadata;
  kind?: string;
  displayName?: string;
}>;

export async function linkCustomerAttachment(input: LinkCustomerAttachmentInput): Promise<void> {
  const result = await db().query<{
    customer_id: string;
    attachment_id: string;
    kind: string | null;
    display_name: string | null;
    media_type: string;
    byte_length: number;
    sha256: string;
    committed_at: Date;
  }>(
    `INSERT INTO customer_attachment_refs (
       customer_id, attachment_id, kind, display_name, media_type,
       byte_length, sha256, committed_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (customer_id, attachment_id) DO NOTHING
     RETURNING customer_id, attachment_id, kind, display_name, media_type,
               byte_length, sha256, committed_at`,
    [
      input.customerId,
      input.attachment.attachmentId,
      input.kind ?? null,
      input.displayName ?? input.attachment.displayName ?? null,
      input.attachment.mediaType,
      input.attachment.byteLength,
      input.attachment.sha256,
      input.attachment.committedAt,
    ],
  );

  if (result.rowCount === 1) return;

  const existing = await db().query<{
    customer_id: string;
    attachment_id: string;
    kind: string | null;
    display_name: string | null;
    media_type: string;
    byte_length: number;
    sha256: string;
  }>(
    `SELECT customer_id, attachment_id, kind, display_name, media_type, byte_length, sha256
       FROM customer_attachment_refs
      WHERE customer_id = $1 AND attachment_id = $2`,
    [input.customerId, input.attachment.attachmentId],
  );
  const row = existing.rows[0];
  if (!row) {
    throw new Error(
      `CUSTOMER_ATTACHMENT_LINK_CONFLICT: attachmentId ${input.attachment.attachmentId} is already linked to another Customer`,
    );
  }

  if (
    row.media_type !== input.attachment.mediaType ||
    row.byte_length !== input.attachment.byteLength ||
    row.sha256 !== input.attachment.sha256 ||
    row.kind !== (input.kind ?? null)
  ) {
    throw new Error(
      `CUSTOMER_ATTACHMENT_LINK_CONFLICT: immutable attachment reference differs for ${input.attachment.attachmentId}`,
    );
  }
}

export async function closeCustomerAttachmentRepository(): Promise<void> {
  const current = pool;
  pool = undefined;
  if (current) await current.end();
}
