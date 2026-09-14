import { createHash } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { Pool } from 'pg';
import { loadRuntimeConfig } from '../src/config/runtime-config.js';
import { S3CompatibleAttachmentStore } from '../src/persistence/attachments/s3-compatible-attachment-store.js';
import {
  closeOperationalInputRepository,
  persistOperationalObservationInput,
  projectAppointmentDirectInput,
} from '../src/persistence/mongo/operational-input.repository.js';
import {
  closeOperationalContextRepository,
  persistOperationalContext,
} from '../src/persistence/mongo/operational-context.repository.js';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`MISSING_ENV:${name}`);
  return value;
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

async function main(): Promise<void> {
  const config = loadRuntimeConfig();
  const postgres = new Pool({ connectionString: config.postgresUrl, max: 2 });
  const mongo = new MongoClient(config.mongoUrl, { maxPoolSize: 4 });
  try {
    const appointmentResult = await postgres.query<{
      business_slug: string;
      workflow_id: string;
      appointment_id: string;
      case_id: string;
      managed_entity_id: string;
      customer_id: string;
    }>(
      `SELECT business_slug,workflow_id,appointment_id,case_id,managed_entity_id,customer_id
         FROM appointments
        WHERE case_id IS NOT NULL AND managed_entity_id IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 1`,
    );
    const appointment = appointmentResult.rows[0];
    if (!appointment) throw new Error('LAYER6_REQUIRES_CERTIFIED_APPOINTMENT_GRAPH');

    await projectAppointmentDirectInput(appointment.workflow_id);
    await projectAppointmentDirectInput(appointment.workflow_id);

    await mongo.connect();
    const db = mongo.db(config.mongoDb);
    const direct = await db.collection('operational_direct_inputs').find({ workflowId: appointment.workflow_id }).toArray();
    if (direct.length !== 1) throw new Error(`DIRECT_INPUT_CARDINALITY:${direct.length}`);
    const directInput = direct[0]!;
    const elements = Array.isArray(directInput.inputElements) ? directInput.inputElements as Array<Record<string, unknown>> : [];
    if (elements.length < 4) throw new Error(`DIRECT_INPUT_ELEMENTS_TOO_FEW:${elements.length}`);
    const elementIds = elements.map((element) => String(element.elementId ?? ''));
    if (elementIds.some((id) => !/^die_[a-f0-9]{24}$/.test(id))) throw new Error('DIRECT_INPUT_ELEMENT_ID_NOT_STABLE');
    if (new Set(elementIds).size !== elementIds.length) throw new Error('DIRECT_INPUT_ELEMENT_ID_DUPLICATE');

    const provenance = await db.collection('operational_provenance').findOne({
      businessSlug: appointment.business_slug,
      'target.type': 'appointment',
      'target.id': appointment.appointment_id,
    });
    if (!provenance) throw new Error('APPOINTMENT_SOURCE_REFS_MISSING');
    const sourceRefs = Array.isArray(provenance.sourceRefs) ? provenance.sourceRefs : [];
    if (sourceRefs.length !== elementIds.length) throw new Error('APPOINTMENT_SOURCE_REFS_INCOMPLETE');

    const store = new S3CompatibleAttachmentStore({
      endpoint: required('LAYER6_S3_ENDPOINT'),
      region: process.env.LAYER6_S3_REGION?.trim() || 'us-east-1',
      bucket: required('LAYER6_S3_BUCKET'),
      accessKeyId: required('LAYER6_S3_ACCESS_KEY_ID'),
      secretAccessKey: required('LAYER6_S3_SECRET_ACCESS_KEY'),
    });
    const payload = Buffer.from('Engines Layer 6 v4 observational evidence\n', 'utf8');
    const ingressRef = `ing_layer6_${appointment.appointment_id.replace(/[^A-Za-z0-9._-]/g, '_')}`;
    const staged = await store.stage({
      ingressRef,
      bytes: payload,
      mediaType: 'text/plain',
      displayName: 'layer6-observation.txt',
      expectedSha256: sha256(payload),
    });
    const committed = await store.commit({
      ingressRef,
      expectedSha256: staged.sha256,
      expectedByteLength: staged.byteLength,
      expectedMediaType: staged.mediaType,
    });
    const readBack = await store.readCommitted(committed.attachmentId);
    if (sha256(readBack) !== committed.sha256) throw new Error('OBJECT_STORE_READBACK_HASH_MISMATCH');
    const committedReplay = await store.commit({ ingressRef });
    if (committedReplay.attachmentId !== committed.attachmentId) throw new Error('OBJECT_STORE_COMMIT_NOT_IDEMPOTENT');

    const now = new Date().toISOString();
    const observationInput = {
      businessSlug: appointment.business_slug,
      caseId: appointment.case_id,
      managedEntityId: appointment.managed_entity_id,
      context: { type: 'appointment_validation', id: appointment.appointment_id },
      inputType: 'layer6_certification_observation',
      channels: ['text', 'object_store'] as const,
      status: 'confirmed' as const,
      author: { type: 'system', id: 'layer6-certifier' },
      review: {
        required: true,
        status: 'confirmed',
        reviewedBy: { type: 'system', id: 'layer6-certifier' },
        reviewedAt: now,
      },
      attachments: [{
        attachmentId: committed.attachmentId,
        customerId: appointment.customer_id,
        attachmentType: 'certification_evidence',
        mimeType: committed.mediaType,
        filename: committed.displayName ?? 'layer6-observation.txt',
        storage: { provider: 's3_compatible', key: `objects/sha256/${committed.sha256}` },
        uploadedBy: { type: 'system', id: 'layer6-certifier' },
        metadata: { sha256: committed.sha256, byteLength: committed.byteLength },
        createdAt: committed.committedAt,
      }],
      payload: {
        operationalInsights: [{
          type: 'certification_finding',
          statement: 'Layer 6 object-backed observation persisted with exclusive evidence ownership.',
          status: 'confirmed',
          confidence: 1,
        }],
      },
      createdAt: now,
      updatedAt: now,
    };
    const observation = await persistOperationalObservationInput(observationInput);
    const observationReplay = await persistOperationalObservationInput(observationInput);
    if (!observationReplay.replay || observationReplay.inputId !== observation.inputId) {
      throw new Error('OBSERVATION_INPUT_REPLAY_NOT_IDEMPOTENT');
    }

    let ownerConflict = false;
    try {
      await persistOperationalObservationInput({
        businessSlug: appointment.business_slug,
        caseId: appointment.case_id,
        managedEntityId: appointment.managed_entity_id,
        context: { type: 'different_context', id: `${appointment.appointment_id}:conflict` },
        inputType: 'layer6_owner_conflict_probe',
        channels: ['text'],
        status: 'captured',
        author: { type: 'system', id: 'layer6-certifier' },
        attachments: [{
          attachmentId: committed.attachmentId,
          customerId: appointment.customer_id,
          attachmentType: 'certification_evidence',
          mimeType: committed.mediaType,
          filename: committed.displayName ?? 'layer6-observation.txt',
          storage: { provider: 's3_compatible', key: `objects/sha256/${committed.sha256}` },
          uploadedBy: { type: 'system', id: 'layer6-certifier' },
          createdAt: committed.committedAt,
        }],
        payload: { operationalInsights: [] },
        createdAt: now,
      });
    } catch (error) {
      ownerConflict = String(error).includes('OBSERVATION_ATTACHMENT_OWNER_CONFLICT');
    }
    if (!ownerConflict) throw new Error('OBSERVATION_ATTACHMENT_EXCLUSIVE_OWNER_NOT_ENFORCED');

    for (const category of ['conversation_log', 'workflow_context', 'flexible_document'] as const) {
      const input = {
        businessSlug: appointment.business_slug,
        category,
        logicalKey: `layer6:${appointment.workflow_id}:${category}`,
        workflowId: appointment.workflow_id,
        conversationId: `layer6-conversation:${appointment.workflow_id}`,
        caseId: appointment.case_id,
        payload: { certified: true, category, appointmentId: appointment.appointment_id },
        occurredAt: now,
      };
      const first = await persistOperationalContext(input);
      const replay = await persistOperationalContext(input);
      if (!replay.replay || first.contextId !== replay.contextId) throw new Error(`CONTEXT_REPLAY_FAILED:${category}`);
    }

    const directIndexes = await db.collection('operational_direct_inputs').listIndexes().toArray();
    const requiredDirectIndexes = new Set([
      'idx_odi_case_time',
      'idx_odi_entity_time',
      'idx_odi_context',
      'idx_odi_status_time',
      'idx_odi_element_id',
      'idx_odi_semantic_key',
    ]);
    for (const index of directIndexes) requiredDirectIndexes.delete(index.name ?? '');
    if (requiredDirectIndexes.size > 0) throw new Error(`DIRECT_INPUT_INDEXES_MISSING:${[...requiredDirectIndexes].join(',')}`);

    const observationCount = await db.collection('operational_observation_inputs').countDocuments({ _id: observation.inputId });
    const attachmentCount = await db.collection('attachments_v4').countDocuments({ _id: committed.attachmentId, operationalObservationInputId: observation.inputId });
    const contextCount = await db.collection('operational_context').countDocuments({ workflowId: appointment.workflow_id });
    if (observationCount !== 1 || attachmentCount !== 1 || contextCount < 3) {
      throw new Error(`LAYER6_MONGO_CARDINALITY:ooi=${observationCount},attachments=${attachmentCount},context=${contextCount}`);
    }

    console.log(`LAYER6_V4_PERSISTENCE_PASS ${JSON.stringify({
      workflowId: appointment.workflow_id,
      appointmentId: appointment.appointment_id,
      caseId: appointment.case_id,
      directInputId: directInput._id,
      directInputElements: elementIds.length,
      observationInputId: observation.inputId,
      observationInsights: observation.insightIds.length,
      attachmentId: committed.attachmentId,
      objectSha256: committed.sha256,
      contextDocuments: contextCount,
      postgres: 'operational graph authoritative',
      mongo: 'v4 operational inputs + context + provenance',
      objectStore: 'S3-compatible / MinIO certified',
    })}`);
  } finally {
    await Promise.allSettled([
      postgres.end(),
      mongo.close(),
      closeOperationalInputRepository(),
      closeOperationalContextRepository(),
    ]);
  }
}

main().catch((error: unknown) => {
  console.error(`LAYER6_V4_PERSISTENCE_FAILED ${JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
  })}`);
  process.exitCode = 1;
});
