import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { loadRuntimeConfig } from '../src/config/runtime-config.js';
import type { ServicesSelectionSnapshot } from '../src/contracts/services-engine/index.js';
import type { QueryAvailabilityInput, SchedulerResource } from '../src/contracts/scheduler-engine/index.js';
import { PostgresSchedulerFoundationRepository } from '../src/persistence/postgres/scheduler-foundation.repository.js';
import { PostgresSchedulerManagementRepository } from '../src/persistence/postgres/scheduler-management.repository.js';
import { PostgresServicesManagementRepository } from '../src/persistence/postgres/services-management.repository.js';
import { PostgresServicesRepository } from '../src/persistence/postgres/services.repository.js';
import { queryDeterministicAvailability } from '../src/scheduler/availability-engine.js';
import {
  materializeAndPersistSchedulingDemand,
  materializeSchedulingDemandFromServicesSnapshot,
  persistSchedulingDemandImmutable,
  ServicesDemandHandoffError,
} from '../src/scheduler/services-demand-handoff.js';

const BUSINESS = 'g2-s6-services-handoff';
const SERVICE_ID = 'svc_g2s6_handoff';
const OFFERING_ID = 'off_g2s6_handoff';
const DEMAND_N = 'demand_g2s6_n';
const DEMAND_N1 = 'demand_g2s6_n1';
const RESOURCE_N = 'res_g2s6_bay';
const RESOURCE_N1 = 'res_g2s6_room';
const NOW = '2026-09-14T23:30:00.000Z';
const WINDOW_START = '2026-09-21T13:00:00.000Z';
const WINDOW_END = '2026-09-21T18:00:00.000Z';

function cloneSnapshot(value: ServicesSelectionSnapshot): ServicesSelectionSnapshot {
  return JSON.parse(JSON.stringify(value)) as ServicesSelectionSnapshot;
}

async function captureCurrentSnapshot(
  services: PostgresServicesRepository,
): Promise<ServicesSelectionSnapshot> {
  const offering = await services.getOffering(BUSINESS, OFFERING_ID);
  assert.ok(offering, 'Offering must exist in Services');
  const service = await services.getService(BUSINESS, offering.serviceId);
  assert.ok(service, 'Service must exist in Services');
  return cloneSnapshot({ service, offering });
}

function resource(
  resourceId: string,
  kind: string,
  code: string,
  capability: string,
): SchedulerResource {
  return {
    resourceId,
    businessSlug: BUSINESS,
    code,
    kind,
    name: code,
    status: 'ACTIVE',
    timeZone: 'America/Lima',
    capacity: 1,
    capabilities: [{ code: capability, capacityUnits: 1 }],
    revision: 1,
  };
}

function availabilityInput(
  requestId: string,
  demand: NonNullable<Awaited<ReturnType<PostgresSchedulerFoundationRepository['getDemand']>>>,
): QueryAvailabilityInput {
  return {
    businessSlug: BUSINESS,
    requestId,
    demand,
    window: {
      startAt: WINDOW_START,
      endAt: WINDOW_END,
      timeZone: 'America/Lima',
    },
    limit: 3,
  };
}

async function run(): Promise<void> {
  const config = loadRuntimeConfig();
  const pool = new Pool({ connectionString: config.postgresUrl, max: 16 });
  const services = new PostgresServicesRepository(pool);
  const servicesManagement = new PostgresServicesManagementRepository(pool);
  const schedulerManagement = new PostgresSchedulerManagementRepository(pool);
  const schedulerFoundation = new PostgresSchedulerFoundationRepository(pool);

  try {
    // Scheduler resources deliberately differ so revision N and N+1 demand
    // semantics resolve to materially different concrete resources.
    await schedulerManagement.createResource({
      businessSlug: BUSINESS,
      operationId: 'g2s6-create-resource-n',
      resource: resource(RESOURCE_N, 'BAY', 'g2s6-bay', 'G2S6_CAP_N'),
    });
    await schedulerManagement.createResource({
      businessSlug: BUSINESS,
      operationId: 'g2s6-create-resource-n1',
      resource: resource(RESOURCE_N1, 'ROOM', 'g2s6-room', 'G2S6_CAP_N1'),
    });
    await schedulerManagement.setScheduleTemplate({
      businessSlug: BUSINESS,
      operationId: 'g2s6-schedule-n',
      expectedRevision: 0,
      schedule: {
        scheduleId: 'schedule_g2s6_n',
        businessSlug: BUSINESS,
        resourceId: RESOURCE_N,
        timeZone: 'America/Lima',
        weeklyWindows: [{ weekday: 1, startLocal: '08:00', endLocal: '13:00', capacity: 1 }],
        revision: 1,
      },
    });
    await schedulerManagement.setScheduleTemplate({
      businessSlug: BUSINESS,
      operationId: 'g2s6-schedule-n1',
      expectedRevision: 0,
      schedule: {
        scheduleId: 'schedule_g2s6_n1',
        businessSlug: BUSINESS,
        resourceId: RESOURCE_N1,
        timeZone: 'America/Lima',
        weeklyWindows: [{ weekday: 1, startLocal: '08:00', endLocal: '13:00', capacity: 1 }],
        revision: 1,
      },
    });

    const createService = await servicesManagement.applyMutation('g2s6-create-service', {
      operation: 'CreateService',
      businessSlug: BUSINESS,
      idempotencyKey: 'g2s6-create-service',
      service: {
        serviceId: SERVICE_ID,
        code: 'g2s6-service',
        name: 'G2-S6 Service N',
        tags: ['g2-s6', 'n'],
      },
    });
    assert.equal(createService.status, 'APPLIED');
    assert.equal(createService.revision, 1);

    const profileN = {
      capacityUnits: 1,
      requiredCapabilities: [
        { code: 'G2S6_CAP_N', quantity: 1, resourceKinds: ['BAY'] },
      ],
      buffers: { beforeMinutes: 5, afterMinutes: 5 },
    } as const;

    const createOffering = await servicesManagement.applyMutation('g2s6-create-offering', {
      operation: 'CreateOffering',
      businessSlug: BUSINESS,
      idempotencyKey: 'g2s6-create-offering',
      offering: {
        offeringId: OFFERING_ID,
        serviceId: SERVICE_ID,
        code: 'g2s6-offering',
        name: 'G2-S6 Offering N',
        durationMinutes: 30,
        pricing: { kind: 'FIXED', amountMinor: 1000, currency: 'PEN' },
        priority: 10,
        tags: ['g2-s6', 'n'],
        requirements: [],
        dependencies: [],
        scheduling: profileN,
      },
    });
    assert.equal(createOffering.status, 'APPLIED');
    assert.equal(createOffering.revision, 1);

    // Capture revision N by value and materialize/persist it before publishing N+1.
    const snapshotN = await captureCurrentSnapshot(services);
    assert.equal(snapshotN.service.revision, 1);
    assert.equal(snapshotN.offering.revision, 1);
    assert.equal(snapshotN.offering.durationMinutes, 30);
    assert.deepEqual(snapshotN.offering.scheduling, profileN);

    const persistedN = await materializeAndPersistSchedulingDemand(pool, snapshotN, DEMAND_N);
    assert.equal(persistedN.replayed, false);
    assert.equal(persistedN.demand.service.revision, 1);
    assert.equal(persistedN.demand.offering.revision, 1);
    assert.equal(persistedN.demand.offering.durationMinutes, 30);
    assert.deepEqual(persistedN.demand.requiredCapabilities, profileN.requiredCapabilities);
    assert.deepEqual(persistedN.demand.buffers, profileN.buffers);

    const replayN = await materializeAndPersistSchedulingDemand(pool, snapshotN, DEMAND_N);
    assert.equal(replayN.replayed, true);
    assert.equal(replayN.snapshotHash, persistedN.snapshotHash);

    const loadedNBefore = await schedulerFoundation.getDemand(BUSINESS, DEMAND_N);
    assert.ok(loadedNBefore);
    const availabilityNBefore = await queryDeterministicAvailability(
      pool,
      availabilityInput('g2s6-n-before-catalog-update', loadedNBefore),
      { granularityMinutes: 15, generatedAt: NOW, asOf: NOW },
    );
    assert.ok(availabilityNBefore.slots.length > 0);
    assert.ok(availabilityNBefore.slots.every((slot) => slot.assignments[0]?.resourceId === RESOURCE_N));
    assert.ok(availabilityNBefore.slots.every((slot) =>
      Date.parse(slot.endAt) - Date.parse(slot.startAt) === 30 * 60_000));

    // Publish materially different Services revision N+1.
    const updateService = await servicesManagement.applyMutation('g2s6-update-service-n1', {
      operation: 'UpdateService',
      businessSlug: BUSINESS,
      idempotencyKey: 'g2s6-update-service-n1',
      serviceId: SERVICE_ID,
      expectedRevision: 1,
      patch: {
        name: 'G2-S6 Service N+1',
        tags: ['g2-s6', 'n+1'],
      },
    });
    assert.equal(updateService.status, 'APPLIED');
    assert.equal(updateService.revision, 2);

    const profileN1 = {
      capacityUnits: 1,
      requiredCapabilities: [
        { code: 'G2S6_CAP_N1', quantity: 1, resourceKinds: ['ROOM'] },
      ],
      buffers: { beforeMinutes: 0, afterMinutes: 15 },
    } as const;

    const updateOffering = await servicesManagement.applyMutation('g2s6-update-offering-n1', {
      operation: 'UpdateOffering',
      businessSlug: BUSINESS,
      idempotencyKey: 'g2s6-update-offering-n1',
      offeringId: OFFERING_ID,
      expectedRevision: 1,
      patch: {
        name: 'G2-S6 Offering N+1',
        durationMinutes: 60,
        pricing: { kind: 'FIXED', amountMinor: 2500, currency: 'PEN' },
        tags: ['g2-s6', 'n+1'],
        scheduling: profileN1,
      },
    });
    assert.equal(updateOffering.status, 'APPLIED');
    assert.equal(updateOffering.revision, 2);

    const snapshotN1 = await captureCurrentSnapshot(services);
    assert.equal(snapshotN1.service.revision, 2);
    assert.equal(snapshotN1.offering.revision, 2);
    assert.equal(snapshotN1.offering.durationMinutes, 60);
    assert.deepEqual(snapshotN1.offering.scheduling, profileN1);

    // Mutable head N+1 cannot rewrite already persisted demand N.
    const loadedNAfter = await schedulerFoundation.getDemand(BUSINESS, DEMAND_N);
    assert.deepEqual(loadedNAfter, loadedNBefore);
    const hashAfter = await pool.query<{ snapshot_hash: string }>(
      `SELECT snapshot_hash FROM scheduler_demands WHERE business_slug=$1 AND demand_id=$2`,
      [BUSINESS, DEMAND_N],
    );
    assert.equal(hashAfter.rows[0]?.snapshot_hash, persistedN.snapshotHash);

    const availabilityNAfter = await queryDeterministicAvailability(
      pool,
      availabilityInput('g2s6-n-after-catalog-update', loadedNAfter!),
      { granularityMinutes: 15, generatedAt: NOW, asOf: NOW },
    );
    assert.deepEqual(
      availabilityNAfter.slots.map((slot) => ({
        startAt: slot.startAt,
        endAt: slot.endAt,
        assignments: slot.assignments,
      })),
      availabilityNBefore.slots.map((slot) => ({
        startAt: slot.startAt,
        endAt: slot.endAt,
        assignments: slot.assignments,
      })),
    );

    // New materialization sees N+1 and drives different Scheduler truth.
    const persistedN1 = await materializeAndPersistSchedulingDemand(pool, snapshotN1, DEMAND_N1);
    assert.equal(persistedN1.replayed, false);
    assert.equal(persistedN1.demand.service.revision, 2);
    assert.equal(persistedN1.demand.offering.revision, 2);
    assert.equal(persistedN1.demand.offering.durationMinutes, 60);
    assert.deepEqual(persistedN1.demand.requiredCapabilities, profileN1.requiredCapabilities);
    assert.deepEqual(persistedN1.demand.buffers, profileN1.buffers);

    const loadedN1 = await schedulerFoundation.getDemand(BUSINESS, DEMAND_N1);
    assert.ok(loadedN1);
    const availabilityN1 = await queryDeterministicAvailability(
      pool,
      availabilityInput('g2s6-n1', loadedN1),
      { granularityMinutes: 15, generatedAt: NOW, asOf: NOW },
    );
    assert.ok(availabilityN1.slots.length > 0);
    assert.ok(availabilityN1.slots.every((slot) => slot.assignments[0]?.resourceId === RESOURCE_N1));
    assert.ok(availabilityN1.slots.every((slot) =>
      Date.parse(slot.endAt) - Date.parse(slot.startAt) === 60 * 60_000));

    // Reusing the durable demand identity with N+1 material must fail closed.
    const conflictingN = materializeSchedulingDemandFromServicesSnapshot(snapshotN1, DEMAND_N);
    await assert.rejects(
      () => persistSchedulingDemandImmutable(pool, conflictingN),
      (error: unknown) => error instanceof ServicesDemandHandoffError
        && error.code === 'DEMAND_MATERIAL_CONFLICT',
    );
    assert.deepEqual(await schedulerFoundation.getDemand(BUSINESS, DEMAND_N), loadedNBefore);

    const demandRows = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM scheduler_demands
        WHERE business_slug=$1 AND demand_id IN ($2,$3)`,
      [BUSINESS, DEMAND_N, DEMAND_N1],
    );
    assert.equal(demandRows.rows[0]?.count, '2');

    console.log(`SCHEDULER_G2_S6_SERVICES_HANDOFF_PASS ${JSON.stringify({
      businessSlug: BUSINESS,
      demandN: {
        demandId: DEMAND_N,
        serviceRevision: loadedNBefore.service.revision,
        offeringRevision: loadedNBefore.offering.revision,
        durationMinutes: loadedNBefore.offering.durationMinutes,
        resourceId: RESOURCE_N,
        snapshotHash: persistedN.snapshotHash,
      },
      demandN1: {
        demandId: DEMAND_N1,
        serviceRevision: loadedN1.service.revision,
        offeringRevision: loadedN1.offering.revision,
        durationMinutes: loadedN1.offering.durationMinutes,
        resourceId: RESOURCE_N1,
        snapshotHash: persistedN1.snapshotHash,
      },
      immutableDemandNAfterCatalogAdvance: true,
      sameDemandReplay: true,
      conflictingDemandIdentityRejected: true,
      appointmentMigration: false,
    })}`);
  } finally {
    await pool.end();
  }
}

run().catch((error: unknown) => {
  console.error(`SCHEDULER_G2_S6_SERVICES_HANDOFF_FAILED ${JSON.stringify({
    error: error instanceof Error ? error.stack ?? error.message : String(error),
  })}`);
  process.exitCode = 1;
});
