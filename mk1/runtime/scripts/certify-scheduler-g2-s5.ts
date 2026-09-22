import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { loadRuntimeConfig } from '../src/config/runtime-config.js';
import type {
  QueryAvailabilityInput,
  SchedulerResource,
  SchedulingDemand,
} from '../src/contracts/scheduler-engine/index.js';
import { PostgresSchedulerManagementRepository } from '../src/persistence/postgres/scheduler-management.repository.js';
import {
  queryDeterministicAvailability,
  SchedulerAvailabilityError,
} from '../src/scheduler/availability-engine.js';
import {
  createHoldAtomic,
  releaseHoldAtomic,
  SchedulerHoldError,
} from '../src/scheduler/hold-engine.js';
import { confirmReservationAtomic } from '../src/scheduler/reservation-engine.js';

const BUSINESS_ALPHA = 'g2-s5-business-alpha';
const BUSINESS_BETA = 'g2-s5-business-beta';
const NOW = '2026-09-14T23:30:00.000Z';
const START = '2026-09-21T09:00:00-05:00';

function alphaResource(): SchedulerResource {
  return {
    resourceId: 'res_g2s5_alpha',
    businessSlug: BUSINESS_ALPHA,
    code: 'primary-resource',
    kind: 'BAY',
    name: 'Alpha Primary Resource',
    status: 'ACTIVE',
    timeZone: 'America/Lima',
    capacity: 1,
    capabilities: [{ code: 'ALPHA_CAPABILITY', capacityUnits: 1 }],
    revision: 1,
  };
}

function betaResource(): SchedulerResource {
  return {
    resourceId: 'res_g2s5_beta',
    businessSlug: BUSINESS_BETA,
    code: 'primary-resource',
    kind: 'ROOM',
    name: 'Beta Primary Resource',
    status: 'ACTIVE',
    timeZone: 'America/Lima',
    capacity: 1,
    capabilities: [{ code: 'BETA_CAPABILITY', capacityUnits: 1 }],
    revision: 1,
  };
}

function alphaDemand(): SchedulingDemand {
  return {
    schemaVersion: 1,
    businessSlug: BUSINESS_ALPHA,
    demandId: 'demand_g2s5_alpha',
    service: { serviceId: 'service_g2s5_alpha', revision: 3 },
    offering: { offeringId: 'offering_g2s5_alpha', revision: 5, durationMinutes: 30 },
    capacityUnits: 1,
    requiredCapabilities: [{ code: 'ALPHA_CAPABILITY', quantity: 1, resourceKinds: ['BAY'] }],
    buffers: { beforeMinutes: 5, afterMinutes: 5 },
  };
}

function betaDemand(): SchedulingDemand {
  return {
    schemaVersion: 1,
    businessSlug: BUSINESS_BETA,
    demandId: 'demand_g2s5_beta',
    service: { serviceId: 'service_g2s5_beta', revision: 7 },
    offering: { offeringId: 'offering_g2s5_beta', revision: 2, durationMinutes: 45 },
    capacityUnits: 1,
    requiredCapabilities: [{ code: 'BETA_CAPABILITY', quantity: 1, resourceKinds: ['ROOM'] }],
    buffers: { beforeMinutes: 0, afterMinutes: 10 },
  };
}

function availabilityInput(
  businessSlug: string,
  requestId: string,
  demand: SchedulingDemand,
  resourceId: string,
): QueryAvailabilityInput {
  const startMs = Date.parse(START);
  const endMs = startMs + demand.offering.durationMinutes * 60_000;
  return {
    businessSlug,
    requestId,
    demand,
    window: {
      startAt: START,
      endAt: new Date(endMs).toISOString(),
      timeZone: 'America/Lima',
    },
    preferredResourceIds: [resourceId],
  };
}

async function oneCandidate(
  pool: Pool,
  businessSlug: string,
  requestId: string,
  demand: SchedulingDemand,
  resourceId: string,
) {
  const result = await queryDeterministicAvailability(
    pool,
    availabilityInput(businessSlug, requestId, demand, resourceId),
    { granularityMinutes: 1, generatedAt: NOW, asOf: NOW },
  );
  assert.equal(result.slots.length, 1, `${requestId} must yield exactly one candidate`);
  return result.slots[0]!;
}

async function run(): Promise<void> {
  const config = loadRuntimeConfig();
  const pool = new Pool({ connectionString: config.postgresUrl, max: 16 });
  const management = new PostgresSchedulerManagementRepository(pool);

  const resourceAlpha = alphaResource();
  const resourceBeta = betaResource();
  const demandAlpha = alphaDemand();
  const demandBeta = betaDemand();

  try {
    // 1) Same command identity and same resource code are legal in different businesses.
    const alphaCreate = await management.createResource({
      businessSlug: BUSINESS_ALPHA,
      operationId: 'shared-create-resource',
      resource: resourceAlpha,
    });
    const betaCreate = await management.createResource({
      businessSlug: BUSINESS_BETA,
      operationId: 'shared-create-resource',
      resource: resourceBeta,
    });
    assert.equal(alphaCreate.replayed, false);
    assert.equal(betaCreate.replayed, false);

    const alphaReplay = await management.createResource({
      businessSlug: BUSINESS_ALPHA,
      operationId: 'shared-create-resource',
      resource: resourceAlpha,
    });
    const betaReplay = await management.createResource({
      businessSlug: BUSINESS_BETA,
      operationId: 'shared-create-resource',
      resource: resourceBeta,
    });
    assert.equal(alphaReplay.replayed, true);
    assert.equal(betaReplay.replayed, true);

    await management.setScheduleTemplate({
      businessSlug: BUSINESS_ALPHA,
      operationId: 'shared-set-schedule',
      expectedRevision: 0,
      schedule: {
        scheduleId: 'schedule_g2s5_alpha',
        businessSlug: BUSINESS_ALPHA,
        resourceId: resourceAlpha.resourceId,
        timeZone: resourceAlpha.timeZone,
        weeklyWindows: [{ weekday: 1, startLocal: '08:00', endLocal: '12:00', capacity: 1 }],
        revision: 1,
      },
    });
    await management.setScheduleTemplate({
      businessSlug: BUSINESS_BETA,
      operationId: 'shared-set-schedule',
      expectedRevision: 0,
      schedule: {
        scheduleId: 'schedule_g2s5_beta',
        businessSlug: BUSINESS_BETA,
        resourceId: resourceBeta.resourceId,
        timeZone: resourceBeta.timeZone,
        weeklyWindows: [{ weekday: 1, startLocal: '07:30', endLocal: '15:30', capacity: 1 }],
        revision: 1,
      },
    });

    assert.equal((await management.readResource(BUSINESS_ALPHA, resourceAlpha.resourceId))?.kind, 'BAY');
    assert.equal((await management.readResource(BUSINESS_BETA, resourceBeta.resourceId))?.kind, 'ROOM');
    assert.equal(await management.readResource(BUSINESS_BETA, resourceAlpha.resourceId), undefined);
    assert.equal(await management.readResource(BUSINESS_ALPHA, resourceBeta.resourceId), undefined);

    // Composite FK scope must reject a schedule in B that points at A's resource.
    await assert.rejects(
      () => management.setScheduleTemplate({
        businessSlug: BUSINESS_BETA,
        operationId: 'cross-business-schedule',
        expectedRevision: 0,
        schedule: {
          scheduleId: 'schedule_g2s5_cross_scope',
          businessSlug: BUSINESS_BETA,
          resourceId: resourceAlpha.resourceId,
          timeZone: resourceAlpha.timeZone,
          weeklyWindows: [{ weekday: 1, startLocal: '08:00', endLocal: '10:00', capacity: 1 }],
          revision: 1,
        },
      }),
      (error: unknown) => Boolean(
        error
        && typeof error === 'object'
        && 'code' in error
        && (error as { code?: string }).code === '23503'
      ),
    );
    const crossScheduleCommand = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM scheduler_commands
        WHERE business_slug=$1 AND operation_id='cross-business-schedule'`,
      [BUSINESS_BETA],
    );
    assert.equal(crossScheduleCommand.rows[0]?.count, '0');

    // 2) Materially different capabilities/kinds resolve only inside their own business.
    const candidateAlpha = await oneCandidate(
      pool,
      BUSINESS_ALPHA,
      'g2s5-alpha-initial',
      demandAlpha,
      resourceAlpha.resourceId,
    );
    const candidateBeta = await oneCandidate(
      pool,
      BUSINESS_BETA,
      'g2s5-beta-initial',
      demandBeta,
      resourceBeta.resourceId,
    );
    assert.notEqual(candidateAlpha.candidateId, candidateBeta.candidateId);

    const foreignPreferred = await queryDeterministicAvailability(
      pool,
      availabilityInput(
        BUSINESS_BETA,
        'g2s5-beta-foreign-resource',
        demandBeta,
        resourceAlpha.resourceId,
      ),
      { granularityMinutes: 1, generatedAt: NOW, asOf: NOW },
    );
    assert.equal(foreignPreferred.slots.length, 0);

    await assert.rejects(
      () => queryDeterministicAvailability(
        pool,
        availabilityInput(
          BUSINESS_BETA,
          'g2s5-cross-demand-scope',
          demandAlpha,
          resourceBeta.resourceId,
        ),
        { granularityMinutes: 1, generatedAt: NOW, asOf: NOW },
      ),
      (error: unknown) => error instanceof SchedulerAvailabilityError
        && error.code === 'SCHEDULING_DEMAND_INVALID',
    );

    // 3) A hold in business A must not reduce availability in business B.
    const alphaHold = await createHoldAtomic(pool, {
      businessSlug: BUSINESS_ALPHA,
      operationId: 'shared-create-hold',
      demand: demandAlpha,
      candidateId: candidateAlpha.candidateId,
      requestedStartAt: candidateAlpha.startAt,
      expiresInSeconds: 900,
    }, { now: NOW });
    assert.equal(alphaHold.replayed, false);

    const betaAfterAlphaHold = await oneCandidate(
      pool,
      BUSINESS_BETA,
      'g2s5-beta-after-alpha-hold',
      demandBeta,
      resourceBeta.resourceId,
    );
    assert.equal(betaAfterAlphaHold.candidateId, candidateBeta.candidateId);

    // Cross-business hold reference must fail closed and cannot mutate A's hold.
    await assert.rejects(
      () => releaseHoldAtomic(pool, {
        businessSlug: BUSINESS_BETA,
        operationId: 'cross-business-release',
        holdId: alphaHold.hold.holdId,
      }, { now: NOW }),
      (error: unknown) => error instanceof SchedulerHoldError && error.code === 'HOLD_NOT_FOUND',
    );
    const alphaHoldStillActive = await pool.query<{ status: string }>(
      `SELECT status FROM scheduler_holds WHERE business_slug=$1 AND hold_id=$2`,
      [BUSINESS_ALPHA, alphaHold.hold.holdId],
    );
    assert.equal(alphaHoldStillActive.rows[0]?.status, 'ACTIVE');

    // 4) Fill A to capacity. B must remain independently available.
    const alphaReservation = await confirmReservationAtomic(pool, {
      businessSlug: BUSINESS_ALPHA,
      operationId: 'shared-confirm-held',
      demand: demandAlpha,
      holdId: alphaHold.hold.holdId,
      requestedStartAt: candidateAlpha.startAt,
    }, { now: NOW });
    assert.equal(alphaReservation.replayed, false);

    const alphaAfterReservation = await queryDeterministicAvailability(
      pool,
      availabilityInput(
        BUSINESS_ALPHA,
        'g2s5-alpha-after-reservation',
        demandAlpha,
        resourceAlpha.resourceId,
      ),
      { granularityMinutes: 1, generatedAt: NOW, asOf: NOW },
    );
    assert.equal(alphaAfterReservation.slots.length, 0, 'business A must be full after its reservation');

    const betaStillAvailable = await oneCandidate(
      pool,
      BUSINESS_BETA,
      'g2s5-beta-after-alpha-reservation',
      demandBeta,
      resourceBeta.resourceId,
    );
    assert.equal(betaStillAvailable.candidateId, candidateBeta.candidateId);

    // 5) The same hold/confirmation operation IDs are independently legal in B.
    const betaHold = await createHoldAtomic(pool, {
      businessSlug: BUSINESS_BETA,
      operationId: 'shared-create-hold',
      demand: demandBeta,
      candidateId: candidateBeta.candidateId,
      requestedStartAt: candidateBeta.startAt,
      expiresInSeconds: 900,
    }, { now: NOW });
    assert.equal(betaHold.replayed, false);
    assert.notEqual(betaHold.hold.holdId, alphaHold.hold.holdId);

    const betaReservation = await confirmReservationAtomic(pool, {
      businessSlug: BUSINESS_BETA,
      operationId: 'shared-confirm-held',
      demand: demandBeta,
      holdId: betaHold.hold.holdId,
      requestedStartAt: candidateBeta.startAt,
    }, { now: NOW });
    assert.equal(betaReservation.replayed, false);
    assert.notEqual(
      betaReservation.reservation.reservationId,
      alphaReservation.reservation.reservationId,
    );

    const betaConfirmReplay = await confirmReservationAtomic(pool, {
      businessSlug: BUSINESS_BETA,
      operationId: 'shared-confirm-held',
      demand: demandBeta,
      holdId: betaHold.hold.holdId,
      requestedStartAt: candidateBeta.startAt,
    }, { now: NOW });
    assert.equal(betaConfirmReplay.replayed, true);
    assert.equal(
      betaConfirmReplay.reservation.reservationId,
      betaReservation.reservation.reservationId,
    );

    // 6) Persisted truth and idempotency are independently business-scoped.
    const state = await pool.query<{
      business_slug: string;
      resources: string;
      reservations: string;
      consumed_holds: string;
    }>(
      `SELECT b.business_slug,
              (SELECT COUNT(*)::text FROM scheduler_resources r WHERE r.business_slug=b.business_slug) AS resources,
              (SELECT COUNT(*)::text FROM scheduler_reservations sr WHERE sr.business_slug=b.business_slug AND sr.status='RESERVED') AS reservations,
              (SELECT COUNT(*)::text FROM scheduler_holds h WHERE h.business_slug=b.business_slug AND h.status='CONSUMED') AS consumed_holds
         FROM (VALUES ($1::text),($2::text)) AS b(business_slug)
        ORDER BY b.business_slug ASC`,
      [BUSINESS_ALPHA, BUSINESS_BETA],
    );
    assert.deepEqual(
      state.rows.map((row) => ({
        business: row.business_slug,
        resources: Number(row.resources),
        reservations: Number(row.reservations),
        consumedHolds: Number(row.consumed_holds),
      })),
      [
        { business: BUSINESS_ALPHA, resources: 1, reservations: 1, consumedHolds: 1 },
        { business: BUSINESS_BETA, resources: 1, reservations: 1, consumedHolds: 1 },
      ],
    );

    const sharedCommands = await pool.query<{ operation_id: string; business_slug: string }>(
      `SELECT operation_id, business_slug
         FROM scheduler_commands
        WHERE operation_id IN ('shared-create-resource','shared-set-schedule','shared-create-hold','shared-confirm-held')
          AND business_slug IN ($1,$2)
        ORDER BY operation_id ASC, business_slug ASC`,
      [BUSINESS_ALPHA, BUSINESS_BETA],
    );
    for (const operationId of [
      'shared-create-resource',
      'shared-set-schedule',
      'shared-create-hold',
      'shared-confirm-held',
    ]) {
      const businesses = sharedCommands.rows
        .filter((row) => row.operation_id === operationId)
        .map((row) => row.business_slug)
        .sort();
      assert.deepEqual(businesses, [BUSINESS_ALPHA, BUSINESS_BETA].sort());
    }

    console.log(`SCHEDULER_G2_S5_MULTIBUSINESS_PASS ${JSON.stringify({
      businesses: [BUSINESS_ALPHA, BUSINESS_BETA],
      resourceKinds: [resourceAlpha.kind, resourceBeta.kind],
      capabilities: [resourceAlpha.capabilities[0]?.code, resourceBeta.capabilities[0]?.code],
      sharedResourceCode: 'primary-resource',
      sharedOperationIdsScopedByBusiness: true,
      crossBusinessScheduleRejected: true,
      crossBusinessDemandRejected: true,
      crossBusinessHoldReferenceRejected: true,
      alphaCapacityDoesNotAffectBeta: true,
      reservations: [
        alphaReservation.reservation.reservationId,
        betaReservation.reservation.reservationId,
      ],
    })}`);
  } finally {
    await pool.end();
  }
}

run().catch((error: unknown) => {
  console.error(`SCHEDULER_G2_S5_MULTIBUSINESS_FAILED ${JSON.stringify({
    error: error instanceof Error ? error.stack ?? error.message : String(error),
  })}`);
  process.exitCode = 1;
});
