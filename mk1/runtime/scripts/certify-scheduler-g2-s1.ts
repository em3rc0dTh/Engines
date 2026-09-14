import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { loadRuntimeConfig } from '../src/config/runtime-config.js';
import type {
  ScheduleOverride,
  ScheduleTemplate,
  SchedulerResource,
} from '../src/contracts/scheduler-engine/index.js';
import {
  PostgresSchedulerManagementRepository,
  SchedulerManagementError,
} from '../src/persistence/postgres/scheduler-management.repository.js';

async function expectManagementFailure(
  code: string,
  work: () => Promise<unknown>,
): Promise<void> {
  try {
    await work();
  } catch (error) {
    assert.ok(error instanceof SchedulerManagementError, `expected SchedulerManagementError, got ${String(error)}`);
    assert.equal(error.code, code);
    return;
  }
  throw new Error(`EXPECTED_${code}`);
}

async function run(): Promise<void> {
  const config = loadRuntimeConfig();
  const pool = new Pool({ connectionString: config.postgresUrl, max: 6 });
  const repository = new PostgresSchedulerManagementRepository(pool);
  const businessSlug = 'g2-s1-management-business';

  const resourceV1: SchedulerResource = {
    resourceId: 'res_g2s1_bay_1',
    businessSlug,
    code: 'bay-1',
    kind: 'BAY',
    name: 'Bay One',
    status: 'ACTIVE',
    timeZone: 'America/Lima',
    capacity: 2,
    capabilities: [{ code: 'WASH_BAY', capacityUnits: 2, metadata: { lane: 'north' } }],
    revision: 1,
  };

  const resourceV2: SchedulerResource = {
    ...resourceV1,
    name: 'Bay One Premium',
    capacity: 3,
    // Canonical read order is capability_code ASC; keep the expected snapshot
    // in that same deterministic order so the round-trip assertion is exact.
    capabilities: [
      { code: 'DETAILING', capacityUnits: 1 },
      { code: 'WASH_BAY', capacityUnits: 3, metadata: { lane: 'north' } },
    ],
    revision: 2,
  };

  const scheduleV1: ScheduleTemplate = {
    scheduleId: 'schedule_g2s1_bay_1',
    businessSlug,
    resourceId: resourceV1.resourceId,
    timeZone: resourceV1.timeZone,
    weeklyWindows: [
      { weekday: 1, startLocal: '08:00', endLocal: '12:00', capacity: 2 },
      { weekday: 1, startLocal: '13:00', endLocal: '17:00', capacity: 2 },
    ],
    revision: 1,
  };

  const scheduleV2: ScheduleTemplate = {
    ...scheduleV1,
    weeklyWindows: [
      { weekday: 1, startLocal: '08:00', endLocal: '18:00', capacity: 3 },
      { weekday: 2, startLocal: '09:00', endLocal: '15:00', capacity: 2 },
    ],
    revision: 2,
  };

  const overrideV1: ScheduleOverride = {
    overrideId: 'override_g2s1_maintenance',
    businessSlug,
    resourceId: resourceV1.resourceId,
    startAt: '2026-09-22T12:00:00-05:00',
    endAt: '2026-09-22T13:00:00-05:00',
    kind: 'UNAVAILABLE',
    reasonCode: 'MAINTENANCE',
    revision: 1,
  };

  const overrideV2: ScheduleOverride = {
    ...overrideV1,
    startAt: '2026-09-22T11:30:00-05:00',
    endAt: '2026-09-22T13:30:00-05:00',
    reasonCode: 'EXTENDED_MAINTENANCE',
    revision: 2,
  };

  try {
    const create = await repository.createResource({
      businessSlug,
      operationId: 'g2s1-create-resource-1',
      resource: resourceV1,
    });
    assert.equal(create.replayed, false);

    const createReplay = await repository.createResource({
      businessSlug,
      operationId: 'g2s1-create-resource-1',
      resource: resourceV1,
    });
    assert.equal(createReplay.replayed, true);
    assert.deepEqual(await repository.readResource(businessSlug, resourceV1.resourceId), resourceV1);

    await expectManagementFailure('IDEMPOTENCY_MATERIAL_CONFLICT', async () => repository.createResource({
      businessSlug,
      operationId: 'g2s1-create-resource-1',
      resource: { ...resourceV1, name: 'Different material' },
    }));

    const update = await repository.updateResource({
      businessSlug,
      operationId: 'g2s1-update-resource-1',
      expectedRevision: 1,
      resource: resourceV2,
    });
    assert.equal(update.replayed, false);
    const updateReplay = await repository.updateResource({
      businessSlug,
      operationId: 'g2s1-update-resource-1',
      expectedRevision: 1,
      resource: resourceV2,
    });
    assert.equal(updateReplay.replayed, true);
    assert.deepEqual(await repository.readResource(businessSlug, resourceV1.resourceId), resourceV2);

    await expectManagementFailure('RESOURCE_REVISION_CONFLICT', async () => repository.updateResource({
      businessSlug,
      operationId: 'g2s1-update-resource-stale',
      expectedRevision: 1,
      resource: { ...resourceV2, revision: 2, name: 'Stale write' },
    }));

    const status = await repository.setResourceStatus({
      businessSlug,
      operationId: 'g2s1-status-resource-1',
      resourceId: resourceV1.resourceId,
      expectedRevision: 2,
      status: 'INACTIVE',
    });
    assert.equal(status.replayed, false);
    const statusReplay = await repository.setResourceStatus({
      businessSlug,
      operationId: 'g2s1-status-resource-1',
      resourceId: resourceV1.resourceId,
      expectedRevision: 2,
      status: 'INACTIVE',
    });
    assert.equal(statusReplay.replayed, true);
    const inactiveResource = await repository.readResource(businessSlug, resourceV1.resourceId);
    assert.ok(inactiveResource);
    assert.equal(inactiveResource.status, 'INACTIVE');
    assert.equal(inactiveResource.revision, 3);

    const scheduleCreate = await repository.setScheduleTemplate({
      businessSlug,
      operationId: 'g2s1-schedule-create-1',
      expectedRevision: 0,
      schedule: scheduleV1,
    });
    assert.equal(scheduleCreate.replayed, false);
    assert.equal((await repository.setScheduleTemplate({
      businessSlug,
      operationId: 'g2s1-schedule-create-1',
      expectedRevision: 0,
      schedule: scheduleV1,
    })).replayed, true);

    const scheduleUpdate = await repository.setScheduleTemplate({
      businessSlug,
      operationId: 'g2s1-schedule-update-1',
      expectedRevision: 1,
      schedule: scheduleV2,
    });
    assert.equal(scheduleUpdate.replayed, false);
    assert.deepEqual(await repository.readScheduleTemplate(businessSlug, scheduleV1.scheduleId), scheduleV2);

    await expectManagementFailure('SCHEDULE_REVISION_CONFLICT', async () => repository.setScheduleTemplate({
      businessSlug,
      operationId: 'g2s1-schedule-stale',
      expectedRevision: 1,
      schedule: scheduleV2,
    }));

    const overrideCreate = await repository.putScheduleOverride({
      businessSlug,
      operationId: 'g2s1-override-create-1',
      expectedRevision: 0,
      override: overrideV1,
    });
    assert.equal(overrideCreate.replayed, false);
    assert.equal((await repository.putScheduleOverride({
      businessSlug,
      operationId: 'g2s1-override-create-1',
      expectedRevision: 0,
      override: overrideV1,
    })).replayed, true);

    const overrideUpdate = await repository.putScheduleOverride({
      businessSlug,
      operationId: 'g2s1-override-update-1',
      expectedRevision: 1,
      override: overrideV2,
    });
    assert.equal(overrideUpdate.replayed, false);
    const persistedOverride = await repository.readScheduleOverride(businessSlug, overrideV1.overrideId);
    assert.ok(persistedOverride);
    assert.equal(persistedOverride.revision, 2);
    assert.equal(persistedOverride.reasonCode, 'EXTENDED_MAINTENANCE');
    assert.equal(Date.parse(persistedOverride.startAt), Date.parse(overrideV2.startAt));
    assert.equal(Date.parse(persistedOverride.endAt), Date.parse(overrideV2.endAt));

    const deleted = await repository.deleteScheduleOverride({
      businessSlug,
      operationId: 'g2s1-override-delete-1',
      overrideId: overrideV1.overrideId,
      expectedRevision: 2,
    });
    assert.equal(deleted.replayed, false);
    assert.equal((await repository.deleteScheduleOverride({
      businessSlug,
      operationId: 'g2s1-override-delete-1',
      overrideId: overrideV1.overrideId,
      expectedRevision: 2,
    })).replayed, true);
    assert.equal(await repository.readScheduleOverride(businessSlug, overrideV1.overrideId), undefined);

    await expectManagementFailure('RESOURCE_NOT_FOUND', async () => repository.setResourceStatus({
      businessSlug: 'other-business',
      operationId: 'g2s1-cross-business-rejected',
      resourceId: resourceV1.resourceId,
      expectedRevision: 3,
      status: 'ACTIVE',
    }));

    const proof = await pool.query<{
      resource_count: string;
      capability_count: string;
      schedule_count: string;
      schedule_window_count: string;
      override_count: string;
      command_count: string;
    }>(
      `SELECT
         (SELECT COUNT(*)::text FROM scheduler_resources WHERE business_slug = $1) AS resource_count,
         (SELECT COUNT(*)::text FROM scheduler_resource_capabilities WHERE business_slug = $1) AS capability_count,
         (SELECT COUNT(*)::text FROM scheduler_schedule_templates WHERE business_slug = $1) AS schedule_count,
         (SELECT COUNT(*)::text FROM scheduler_schedule_windows WHERE business_slug = $1) AS schedule_window_count,
         (SELECT COUNT(*)::text FROM scheduler_schedule_overrides WHERE business_slug = $1) AS override_count,
         (SELECT COUNT(*)::text FROM scheduler_commands WHERE business_slug = $1) AS command_count`,
      [businessSlug],
    );
    assert.deepEqual(proof.rows[0], {
      resource_count: '1',
      capability_count: '2',
      schedule_count: '1',
      schedule_window_count: '2',
      override_count: '0',
      command_count: '8',
    });

    console.log(`SCHEDULER_G2_S1_EVIDENCE ${JSON.stringify({
      businessSlug,
      resourceId: resourceV1.resourceId,
      resourceRevision: inactiveResource.revision,
      resourceStatus: inactiveResource.status,
      capabilityCodes: inactiveResource.capabilities.map((entry) => entry.code),
      scheduleId: scheduleV1.scheduleId,
      scheduleRevision: scheduleV2.revision,
      overrideLifecycle: ['CREATE', 'UPDATE', 'DELETE'],
      sameMaterialReplayNoOp: true,
      materialConflictRejected: true,
      staleResourceRevisionRejected: true,
      staleScheduleRevisionRejected: true,
      crossBusinessMutationRejected: true,
      successfulCommandCount: 8,
    })}`);
    console.log('SCHEDULER_G2_S1_MANAGEMENT_PASS');
  } finally {
    await pool.end();
  }
}

run().catch((error: unknown) => {
  console.error(`SCHEDULER_G2_S1_MANAGEMENT_FAILED ${JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
    code: error instanceof SchedulerManagementError ? error.code : undefined,
  })}`);
  process.exitCode = 1;
});
