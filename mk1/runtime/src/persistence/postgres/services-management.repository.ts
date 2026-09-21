import { createHash } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { loadRuntimeConfig } from '../../config/runtime-config.js';
import { canonicalJson } from '../../contracts/register-new-customer/index.js';
import type {
  PricingDescriptor,
  ServiceDefinition,
  ServiceOffering,
  ServiceRequirement,
  ServiceDependency,
  EligibilityRuleSet,
  ServicesMutationCommand,
  ServicesMutationOutcome,
  ServicesMutationRejected,
} from '../../contracts/services-engine/index.js';

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function asStringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Readonly<Record<string, unknown>>;
}

function pricingColumns(pricing: PricingDescriptor): readonly [string, number | null, string | null] {
  if (pricing.kind === 'FREE' || pricing.kind === 'QUOTE_REQUIRED') {
    return [pricing.kind, null, null];
  }
  return [pricing.kind, pricing.amountMinor, pricing.currency];
}

function pricingFromRow(row: {
  price_kind: string;
  price_amount_minor: string | number | null;
  price_currency: string | null;
}): PricingDescriptor {
  if (row.price_kind === 'FREE') return { kind: 'FREE' };
  if (row.price_kind === 'QUOTE_REQUIRED') return { kind: 'QUOTE_REQUIRED' };
  if (row.price_kind === 'FIXED' || row.price_kind === 'FROM') {
    const amountMinor = Number(row.price_amount_minor);
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 0 || !row.price_currency) {
      throw new Error(`SERVICES_PRICE_PROJECTION_INVALID:${row.price_kind}`);
    }
    return { kind: row.price_kind, amountMinor, currency: row.price_currency };
  }
  throw new Error(`SERVICES_PRICE_KIND_UNKNOWN:${row.price_kind}`);
}

function rejected(
  command: ServicesMutationCommand,
  code: ServicesMutationRejected['code'],
  message: string,
  extra: Partial<Pick<ServicesMutationRejected, 'entityType' | 'entityId' | 'expectedRevision' | 'currentRevision'>> = {},
): ServicesMutationRejected {
  return {
    status: 'REJECTED',
    operation: command.operation,
    businessSlug: command.businessSlug,
    idempotencyKey: command.idempotencyKey,
    code,
    message,
    ...extra,
  };
}

function entityInfo(command: ServicesMutationCommand): Readonly<{
  entityType: 'SERVICE' | 'OFFERING';
  entityId: string;
}> {
  switch (command.operation) {
    case 'CreateService': return { entityType: 'SERVICE', entityId: command.service.serviceId };
    case 'UpdateService':
    case 'SetServiceStatus': return { entityType: 'SERVICE', entityId: command.serviceId };
    case 'CreateOffering': return { entityType: 'OFFERING', entityId: command.offering.offeringId };
    case 'UpdateOffering':
    case 'SetOfferingStatus': return { entityType: 'OFFERING', entityId: command.offeringId };
  }
}

async function loadService(
  client: PoolClient,
  businessSlug: string,
  serviceId: string,
): Promise<ServiceDefinition | undefined> {
  const result = await client.query<{
    service_id: string;
    business_slug: string;
    service_code: string;
    service_name: string;
    description: string | null;
    status: 'ACTIVE' | 'INACTIVE';
    revision: number;
    tags: unknown;
  }>(
    `SELECT service_id, business_slug, service_code, service_name, description, status, revision, tags
       FROM service_catalog
      WHERE business_slug = $1 AND service_id = $2`,
    [businessSlug, serviceId],
  );
  const row = result.rows[0];
  if (!row) return undefined;
  return {
    serviceId: row.service_id,
    businessSlug: row.business_slug,
    code: row.service_code,
    name: row.service_name,
    ...(row.description ? { description: row.description } : {}),
    status: row.status,
    revision: row.revision,
    tags: asStringArray(row.tags),
  };
}

type OfferingBaseRow = Readonly<{
  product_id: string;
  service_id: string;
  business_slug: string;
  product_code: string;
  product_name: string;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  revision: number;
  duration_minutes: number;
  priority: number;
  tags: unknown;
  price_kind: string;
  price_amount_minor: string | number | null;
  price_currency: string | null;
}>;

async function loadOffering(
  client: PoolClient,
  businessSlug: string,
  offeringId: string,
): Promise<ServiceOffering | undefined> {
  const base = await client.query<OfferingBaseRow>(
    `SELECT product_id, service_id, business_slug, product_code, product_name,
            description, status, revision, duration_minutes, priority, tags,
            price_kind, price_amount_minor, price_currency
       FROM service_products
      WHERE business_slug = $1 AND product_id = $2`,
    [businessSlug, offeringId],
  );
  const row = base.rows[0];
  if (!row) return undefined;

  const [requirementsResult, dependenciesResult, eligibilityResult] = await Promise.all([
    client.query<{
      requirement_code: string;
      requirement_kind: ServiceRequirement['kind'];
      required: boolean;
      config: unknown;
    }>(
      `SELECT requirement_code, requirement_kind, required, config
         FROM service_requirements
        WHERE business_slug = $1 AND product_id = $2
        ORDER BY requirement_code ASC`,
      [businessSlug, offeringId],
    ),
    client.query<{
      target_product_id: string;
      relation: ServiceDependency['relation'];
    }>(
      `SELECT target_product_id, relation
         FROM service_dependencies
        WHERE business_slug = $1 AND source_product_id = $2
        ORDER BY relation ASC, target_product_id ASC`,
      [businessSlug, offeringId],
    ),
    client.query<{
      mode: 'ALL';
      predicates: unknown;
      failure_code: string;
    }>(
      `SELECT mode, predicates, failure_code
         FROM service_eligibility_rules
        WHERE business_slug = $1 AND product_id = $2`,
      [businessSlug, offeringId],
    ),
  ]);

  const eligibilityRow = eligibilityResult.rows[0];
  const eligibilityRuleSet: EligibilityRuleSet | undefined = eligibilityRow
    ? {
        mode: eligibilityRow.mode,
        predicates: Array.isArray(eligibilityRow.predicates)
          ? eligibilityRow.predicates as EligibilityRuleSet['predicates']
          : [],
        failureCode: eligibilityRow.failure_code,
      }
    : undefined;

  return {
    offeringId: row.product_id,
    serviceId: row.service_id,
    businessSlug: row.business_slug,
    code: row.product_code,
    name: row.product_name,
    ...(row.description ? { description: row.description } : {}),
    status: row.status,
    revision: row.revision,
    durationMinutes: row.duration_minutes,
    pricing: pricingFromRow(row),
    priority: row.priority,
    tags: asStringArray(row.tags),
    requirements: requirementsResult.rows.map((item) => ({
      code: item.requirement_code,
      kind: item.requirement_kind,
      required: item.required,
      config: asRecord(item.config),
    })),
    dependencies: dependenciesResult.rows.map((item) => ({
      relation: item.relation,
      targetOfferingId: item.target_product_id,
    })),
    ...(eligibilityRuleSet ? { eligibilityRuleSet } : {}),
  };
}

async function replaceOfferingRequirements(
  client: PoolClient,
  businessSlug: string,
  offeringId: string,
  requirements: readonly ServiceRequirement[],
): Promise<void> {
  await client.query(
    `DELETE FROM service_requirements WHERE business_slug = $1 AND product_id = $2`,
    [businessSlug, offeringId],
  );
  for (const requirement of requirements) {
    await client.query(
      `INSERT INTO service_requirements (
         requirement_id, business_slug, product_id, requirement_code,
         requirement_kind, required, config
       ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
      [
        `req_${sha256(canonicalJson([businessSlug, offeringId, requirement.code])).slice(0, 24)}`,
        businessSlug,
        offeringId,
        requirement.code,
        requirement.kind,
        requirement.required,
        JSON.stringify(requirement.config),
      ],
    );
  }
}

async function replaceOfferingDependencies(
  client: PoolClient,
  businessSlug: string,
  offeringId: string,
  dependencies: readonly ServiceDependency[],
): Promise<ServicesMutationRejected | undefined> {
  for (const dependency of dependencies) {
    const target = await client.query<{ product_id: string }>(
      `SELECT product_id FROM service_products WHERE business_slug = $1 AND product_id = $2`,
      [businessSlug, dependency.targetOfferingId],
    );
    if (!target.rows[0]) {
      return {
        status: 'REJECTED',
        operation: 'UpdateOffering',
        businessSlug,
        idempotencyKey: '',
        code: 'NOT_FOUND',
        message: `dependency target not found in business scope: ${dependency.targetOfferingId}`,
        entityType: 'OFFERING',
        entityId: offeringId,
      };
    }
  }
  await client.query(
    `DELETE FROM service_dependencies WHERE business_slug = $1 AND source_product_id = $2`,
    [businessSlug, offeringId],
  );
  for (const dependency of dependencies) {
    await client.query(
      `INSERT INTO service_dependencies (
         dependency_id, business_slug, source_product_id, target_product_id, relation
       ) VALUES ($1,$2,$3,$4,$5)`,
      [
        `dep_${sha256(canonicalJson([businessSlug, offeringId, dependency.relation, dependency.targetOfferingId])).slice(0, 24)}`,
        businessSlug,
        offeringId,
        dependency.targetOfferingId,
        dependency.relation,
      ],
    );
  }
  return undefined;
}

async function replaceEligibility(
  client: PoolClient,
  businessSlug: string,
  offeringId: string,
  eligibilityRuleSet: EligibilityRuleSet | null | undefined,
): Promise<void> {
  if (eligibilityRuleSet === undefined) return;
  await client.query(
    `DELETE FROM service_eligibility_rules WHERE business_slug = $1 AND product_id = $2`,
    [businessSlug, offeringId],
  );
  if (eligibilityRuleSet === null) return;
  await client.query(
    `INSERT INTO service_eligibility_rules (
       rule_id, business_slug, product_id, mode, predicates, failure_code
     ) VALUES ($1,$2,$3,$4,$5::jsonb,$6)`,
    [
      `elg_${sha256(canonicalJson([businessSlug, offeringId])).slice(0, 24)}`,
      businessSlug,
      offeringId,
      eligibilityRuleSet.mode,
      JSON.stringify(eligibilityRuleSet.predicates),
      eligibilityRuleSet.failureCode,
    ],
  );
}

async function checkServiceCodeConflict(
  client: PoolClient,
  businessSlug: string,
  code: string,
  exceptServiceId?: string,
): Promise<boolean> {
  const result = await client.query<{ service_id: string }>(
    `SELECT service_id FROM service_catalog
      WHERE business_slug = $1 AND service_code = $2
        AND ($3::text IS NULL OR service_id <> $3)
      LIMIT 1`,
    [businessSlug, code, exceptServiceId ?? null],
  );
  return Boolean(result.rows[0]);
}

async function checkOfferingCodeConflict(
  client: PoolClient,
  businessSlug: string,
  code: string,
  exceptOfferingId?: string,
): Promise<boolean> {
  const result = await client.query<{ product_id: string }>(
    `SELECT product_id FROM service_products
      WHERE business_slug = $1 AND product_code = $2
        AND ($3::text IS NULL OR product_id <> $3)
      LIMIT 1`,
    [businessSlug, code, exceptOfferingId ?? null],
  );
  return Boolean(result.rows[0]);
}

async function applyOperation(
  client: PoolClient,
  command: ServicesMutationCommand,
): Promise<ServicesMutationOutcome> {
  switch (command.operation) {
    case 'CreateService': {
      const globalId = await client.query<{ business_slug: string }>(
        `SELECT business_slug FROM service_catalog WHERE service_id = $1`,
        [command.service.serviceId],
      );
      if (globalId.rows[0] || await checkServiceCodeConflict(client, command.businessSlug, command.service.code)) {
        return rejected(command, 'IDENTITY_CONFLICT', 'Service id or code already exists', {
          entityType: 'SERVICE', entityId: command.service.serviceId,
        });
      }
      await client.query(
        `INSERT INTO service_catalog (
           service_id, business_slug, service_code, service_name, description,
           active, revision, tags
         ) VALUES ($1,$2,$3,$4,$5,TRUE,1,$6::jsonb)`,
        [
          command.service.serviceId,
          command.businessSlug,
          command.service.code,
          command.service.name,
          command.service.description ?? null,
          JSON.stringify(command.service.tags),
        ],
      );
      const entity = await loadService(client, command.businessSlug, command.service.serviceId);
      if (!entity) throw new Error('SERVICES_CREATE_SERVICE_PROJECTION_MISSING');
      return {
        status: 'APPLIED', operation: command.operation, businessSlug: command.businessSlug,
        idempotencyKey: command.idempotencyKey, entityType: 'SERVICE', entityId: entity.serviceId,
        revision: entity.revision, entity,
      };
    }
    case 'UpdateService': {
      const current = await loadService(client, command.businessSlug, command.serviceId);
      if (!current) return rejected(command, 'NOT_FOUND', 'Service not found', { entityType: 'SERVICE', entityId: command.serviceId });
      if (current.revision !== command.expectedRevision) {
        return rejected(command, 'REVISION_CONFLICT', 'Service revision is stale', {
          entityType: 'SERVICE', entityId: command.serviceId,
          expectedRevision: command.expectedRevision, currentRevision: current.revision,
        });
      }
      const nextCode = command.patch.code ?? current.code;
      if (await checkServiceCodeConflict(client, command.businessSlug, nextCode, command.serviceId)) {
        return rejected(command, 'IDENTITY_CONFLICT', 'Service code already exists', { entityType: 'SERVICE', entityId: command.serviceId });
      }
      const nextName = command.patch.name ?? current.name;
      const nextDescription = Object.hasOwn(command.patch, 'description')
        ? command.patch.description ?? null
        : current.description ?? null;
      const nextTags = command.patch.tags ?? current.tags;
      await client.query(
        `UPDATE service_catalog
            SET service_code = $3, service_name = $4, description = $5,
                tags = $6::jsonb, revision = revision + 1, updated_at = NOW()
          WHERE business_slug = $1 AND service_id = $2`,
        [command.businessSlug, command.serviceId, nextCode, nextName, nextDescription, JSON.stringify(nextTags)],
      );
      const entity = await loadService(client, command.businessSlug, command.serviceId);
      if (!entity) throw new Error('SERVICES_UPDATE_SERVICE_PROJECTION_MISSING');
      return {
        status: 'APPLIED', operation: command.operation, businessSlug: command.businessSlug,
        idempotencyKey: command.idempotencyKey, entityType: 'SERVICE', entityId: entity.serviceId,
        revision: entity.revision, entity,
      };
    }
    case 'SetServiceStatus': {
      const current = await loadService(client, command.businessSlug, command.serviceId);
      if (!current) return rejected(command, 'NOT_FOUND', 'Service not found', { entityType: 'SERVICE', entityId: command.serviceId });
      if (current.revision !== command.expectedRevision) {
        return rejected(command, 'REVISION_CONFLICT', 'Service revision is stale', {
          entityType: 'SERVICE', entityId: command.serviceId,
          expectedRevision: command.expectedRevision, currentRevision: current.revision,
        });
      }
      await client.query(
        `UPDATE service_catalog
            SET active = $3, revision = revision + 1, updated_at = NOW()
          WHERE business_slug = $1 AND service_id = $2`,
        [command.businessSlug, command.serviceId, command.status === 'ACTIVE'],
      );
      const entity = await loadService(client, command.businessSlug, command.serviceId);
      if (!entity) throw new Error('SERVICES_STATUS_SERVICE_PROJECTION_MISSING');
      return {
        status: 'APPLIED', operation: command.operation, businessSlug: command.businessSlug,
        idempotencyKey: command.idempotencyKey, entityType: 'SERVICE', entityId: entity.serviceId,
        revision: entity.revision, entity,
      };
    }
    case 'CreateOffering': {
      const parent = await loadService(client, command.businessSlug, command.offering.serviceId);
      if (!parent) return rejected(command, 'PARENT_NOT_FOUND', 'Parent Service not found in business scope', {
        entityType: 'OFFERING', entityId: command.offering.offeringId,
      });
      const globalId = await client.query<{ business_slug: string }>(
        `SELECT business_slug FROM service_products WHERE product_id = $1`,
        [command.offering.offeringId],
      );
      if (globalId.rows[0] || await checkOfferingCodeConflict(client, command.businessSlug, command.offering.code)) {
        return rejected(command, 'IDENTITY_CONFLICT', 'Offering id or code already exists', {
          entityType: 'OFFERING', entityId: command.offering.offeringId,
        });
      }
      const [kind, amountMinor, currency] = pricingColumns(command.offering.pricing);
      await client.query(
        `INSERT INTO service_products (
           product_id, service_id, business_slug, product_code, product_name, description,
           duration_minutes, active, revision, priority, tags,
           price_kind, price_amount_minor, price_currency
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,1,$8,$9::jsonb,$10,$11,$12)`,
        [
          command.offering.offeringId,
          command.offering.serviceId,
          command.businessSlug,
          command.offering.code,
          command.offering.name,
          command.offering.description ?? null,
          command.offering.durationMinutes,
          command.offering.priority,
          JSON.stringify(command.offering.tags),
          kind,
          amountMinor,
          currency,
        ],
      );
      await replaceOfferingRequirements(client, command.businessSlug, command.offering.offeringId, command.offering.requirements);
      const dependencyError = await replaceOfferingDependencies(client, command.businessSlug, command.offering.offeringId, command.offering.dependencies);
      if (dependencyError) return { ...dependencyError, operation: command.operation, idempotencyKey: command.idempotencyKey };
      await replaceEligibility(client, command.businessSlug, command.offering.offeringId, command.offering.eligibilityRuleSet ?? null);
      const entity = await loadOffering(client, command.businessSlug, command.offering.offeringId);
      if (!entity) throw new Error('SERVICES_CREATE_OFFERING_PROJECTION_MISSING');
      return {
        status: 'APPLIED', operation: command.operation, businessSlug: command.businessSlug,
        idempotencyKey: command.idempotencyKey, entityType: 'OFFERING', entityId: entity.offeringId,
        revision: entity.revision, entity,
      };
    }
    case 'UpdateOffering': {
      const current = await loadOffering(client, command.businessSlug, command.offeringId);
      if (!current) return rejected(command, 'NOT_FOUND', 'Offering not found', { entityType: 'OFFERING', entityId: command.offeringId });
      if (current.revision !== command.expectedRevision) {
        return rejected(command, 'REVISION_CONFLICT', 'Offering revision is stale', {
          entityType: 'OFFERING', entityId: command.offeringId,
          expectedRevision: command.expectedRevision, currentRevision: current.revision,
        });
      }
      const nextServiceId = command.patch.serviceId ?? current.serviceId;
      if (!await loadService(client, command.businessSlug, nextServiceId)) {
        return rejected(command, 'PARENT_NOT_FOUND', 'Parent Service not found in business scope', { entityType: 'OFFERING', entityId: command.offeringId });
      }
      const nextCode = command.patch.code ?? current.code;
      if (await checkOfferingCodeConflict(client, command.businessSlug, nextCode, command.offeringId)) {
        return rejected(command, 'IDENTITY_CONFLICT', 'Offering code already exists', { entityType: 'OFFERING', entityId: command.offeringId });
      }
      const nextName = command.patch.name ?? current.name;
      const nextDescription = Object.hasOwn(command.patch, 'description')
        ? command.patch.description ?? null
        : current.description ?? null;
      const nextDuration = command.patch.durationMinutes ?? current.durationMinutes;
      const nextPricing = command.patch.pricing ?? current.pricing;
      const nextPriority = command.patch.priority ?? current.priority;
      const nextTags = command.patch.tags ?? current.tags;
      const [kind, amountMinor, currency] = pricingColumns(nextPricing);
      await client.query(
        `UPDATE service_products
            SET service_id = $3, product_code = $4, product_name = $5, description = $6,
                duration_minutes = $7, priority = $8, tags = $9::jsonb,
                price_kind = $10, price_amount_minor = $11, price_currency = $12,
                revision = revision + 1, updated_at = NOW()
          WHERE business_slug = $1 AND product_id = $2`,
        [command.businessSlug, command.offeringId, nextServiceId, nextCode, nextName, nextDescription,
          nextDuration, nextPriority, JSON.stringify(nextTags), kind, amountMinor, currency],
      );
      if (command.patch.requirements !== undefined) {
        await replaceOfferingRequirements(client, command.businessSlug, command.offeringId, command.patch.requirements);
      }
      if (command.patch.dependencies !== undefined) {
        const dependencyError = await replaceOfferingDependencies(client, command.businessSlug, command.offeringId, command.patch.dependencies);
        if (dependencyError) return { ...dependencyError, operation: command.operation, idempotencyKey: command.idempotencyKey };
      }
      await replaceEligibility(client, command.businessSlug, command.offeringId, command.patch.eligibilityRuleSet);
      const entity = await loadOffering(client, command.businessSlug, command.offeringId);
      if (!entity) throw new Error('SERVICES_UPDATE_OFFERING_PROJECTION_MISSING');
      return {
        status: 'APPLIED', operation: command.operation, businessSlug: command.businessSlug,
        idempotencyKey: command.idempotencyKey, entityType: 'OFFERING', entityId: entity.offeringId,
        revision: entity.revision, entity,
      };
    }
    case 'SetOfferingStatus': {
      const current = await loadOffering(client, command.businessSlug, command.offeringId);
      if (!current) return rejected(command, 'NOT_FOUND', 'Offering not found', { entityType: 'OFFERING', entityId: command.offeringId });
      if (current.revision !== command.expectedRevision) {
        return rejected(command, 'REVISION_CONFLICT', 'Offering revision is stale', {
          entityType: 'OFFERING', entityId: command.offeringId,
          expectedRevision: command.expectedRevision, currentRevision: current.revision,
        });
      }
      await client.query(
        `UPDATE service_products
            SET active = $3, revision = revision + 1, updated_at = NOW()
          WHERE business_slug = $1 AND product_id = $2`,
        [command.businessSlug, command.offeringId, command.status === 'ACTIVE'],
      );
      const entity = await loadOffering(client, command.businessSlug, command.offeringId);
      if (!entity) throw new Error('SERVICES_STATUS_OFFERING_PROJECTION_MISSING');
      return {
        status: 'APPLIED', operation: command.operation, businessSlug: command.businessSlug,
        idempotencyKey: command.idempotencyKey, entityType: 'OFFERING', entityId: entity.offeringId,
        revision: entity.revision, entity,
      };
    }
  }
}

function replayOutcome(payload: unknown): ServicesMutationOutcome {
  const outcome = payload as ServicesMutationOutcome;
  if (outcome.status === 'APPLIED') return { ...outcome, status: 'REPLAYED' };
  return outcome;
}

export class PostgresServicesManagementRepository {
  constructor(private readonly pool: Pool) {}

  async applyMutation(
    workflowId: string,
    command: ServicesMutationCommand,
  ): Promise<ServicesMutationOutcome> {
    const client = await this.pool.connect();
    const idempotencyKeyHash = sha256(command.idempotencyKey);
    const commandFingerprint = sha256(canonicalJson(command));
    const info = entityInfo(command);
    const commandId = `svc_cmd_${sha256(canonicalJson([command.operation, command.businessSlug, idempotencyKeyHash])).slice(0, 32)}`;

    try {
      await client.query('BEGIN');
      const existing = await client.query<{
        command_fingerprint: string;
        status: 'RESERVED' | 'APPLIED' | 'REJECTED';
        result_payload: unknown;
      }>(
        `SELECT command_fingerprint, status, result_payload
           FROM service_mutation_commands
          WHERE operation = $1 AND business_slug = $2 AND idempotency_key_hash = $3
          FOR UPDATE`,
        [command.operation, command.businessSlug, idempotencyKeyHash],
      );
      const row = existing.rows[0];
      if (row) {
        if (row.command_fingerprint !== commandFingerprint) {
          await client.query('ROLLBACK');
          return rejected(command, 'IDEMPOTENCY_CONFLICT', 'idempotency identity was reused with different material', {
            entityType: info.entityType,
            entityId: info.entityId,
          });
        }
        if (row.result_payload) {
          const outcome = replayOutcome(row.result_payload);
          await client.query('COMMIT');
          return outcome;
        }
      } else {
        await client.query(
          `INSERT INTO service_mutation_commands (
             command_id, operation, business_slug, idempotency_key_hash,
             command_fingerprint, workflow_id, entity_type, entity_id, status
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'RESERVED')`,
          [commandId, command.operation, command.businessSlug, idempotencyKeyHash,
            commandFingerprint, workflowId, info.entityType, info.entityId],
        );
      }

      const outcome = await applyOperation(client, command);
      await client.query(
        `UPDATE service_mutation_commands
            SET status = $4, result_payload = $5::jsonb, updated_at = NOW()
          WHERE operation = $1 AND business_slug = $2 AND idempotency_key_hash = $3`,
        [command.operation, command.businessSlug, idempotencyKeyHash,
          outcome.status === 'APPLIED' ? 'APPLIED' : 'REJECTED', JSON.stringify(outcome)],
      );
      await client.query('COMMIT');
      return outcome;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

let defaultPool: Pool | undefined;
let defaultRepository: PostgresServicesManagementRepository | undefined;

export function servicesManagementRepository(): PostgresServicesManagementRepository {
  defaultPool ??= new Pool({ connectionString: loadRuntimeConfig().postgresUrl, max: 8 });
  defaultRepository ??= new PostgresServicesManagementRepository(defaultPool);
  return defaultRepository;
}

export async function closeServicesManagementRepository(): Promise<void> {
  const current = defaultPool;
  defaultPool = undefined;
  defaultRepository = undefined;
  if (current) await current.end();
}
