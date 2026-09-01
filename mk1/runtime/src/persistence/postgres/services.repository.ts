import { Pool } from 'pg';
import { loadRuntimeConfig } from '../../config/runtime-config.js';
import type {
  EligibilityRuleSet,
  PricingDescriptor,
  ServiceDefinition,
  ServiceDependency,
  ServiceOffering,
  ServiceRequirement,
} from '../../contracts/services-engine/index.js';

function asStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Readonly<Record<string, unknown>>;
}

function pricingFromRow(row: {
  price_kind: string;
  price_amount_minor: string | number | null;
  price_currency: string | null;
}): PricingDescriptor {
  switch (row.price_kind) {
    case 'FREE':
      return { kind: 'FREE' };
    case 'QUOTE_REQUIRED':
      return { kind: 'QUOTE_REQUIRED' };
    case 'FIXED':
    case 'FROM': {
      const amountMinor = Number(row.price_amount_minor);
      if (!Number.isSafeInteger(amountMinor) || amountMinor < 0 || !row.price_currency) {
        throw new Error(`SERVICES_PRICE_PROJECTION_INVALID:${row.price_kind}`);
      }
      return { kind: row.price_kind, amountMinor, currency: row.price_currency };
    }
    default:
      throw new Error(`SERVICES_PRICE_KIND_UNKNOWN:${row.price_kind}`);
  }
}

function serviceFromRow(row: {
  service_id: string;
  business_slug: string;
  service_code: string;
  service_name: string;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  revision: number;
  tags: unknown;
}): ServiceDefinition {
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

type OfferingRow = Readonly<{
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

type RequirementRow = Readonly<{
  product_id: string;
  requirement_code: string;
  requirement_kind: ServiceRequirement['kind'];
  required: boolean;
  config: unknown;
}>;

type DependencyRow = Readonly<{
  source_product_id: string;
  target_product_id: string;
  relation: ServiceDependency['relation'];
}>;

type EligibilityRow = Readonly<{
  product_id: string;
  mode: 'ALL';
  predicates: unknown;
  failure_code: string;
}>;

function eligibilityFromRow(row: EligibilityRow | undefined): EligibilityRuleSet | undefined {
  if (!row) return undefined;
  if (!Array.isArray(row.predicates)) {
    throw new Error(`SERVICES_ELIGIBILITY_PROJECTION_INVALID:${row.product_id}`);
  }
  return {
    mode: row.mode,
    predicates: row.predicates as EligibilityRuleSet['predicates'],
    failureCode: row.failure_code,
  };
}

export class PostgresServicesRepository {
  constructor(private readonly pool: Pool) {}

  async listServices(businessSlug: string): Promise<readonly ServiceDefinition[]> {
    const result = await this.pool.query<{
      service_id: string;
      business_slug: string;
      service_code: string;
      service_name: string;
      description: string | null;
      status: 'ACTIVE' | 'INACTIVE';
      revision: number;
      tags: unknown;
    }>(
      `SELECT service_id, business_slug, service_code, service_name,
              description, status, revision, tags
         FROM service_catalog
        WHERE business_slug = $1 AND active = TRUE
        ORDER BY service_name ASC, service_id ASC`,
      [businessSlug],
    );
    return result.rows.map(serviceFromRow);
  }

  async getService(
    businessSlug: string,
    serviceIdOrCode: string,
  ): Promise<ServiceDefinition | undefined> {
    const result = await this.pool.query<{
      service_id: string;
      business_slug: string;
      service_code: string;
      service_name: string;
      description: string | null;
      status: 'ACTIVE' | 'INACTIVE';
      revision: number;
      tags: unknown;
    }>(
      `SELECT service_id, business_slug, service_code, service_name,
              description, status, revision, tags
         FROM service_catalog
        WHERE business_slug = $1
          AND (service_id = $2 OR service_code = $2)
        ORDER BY CASE WHEN service_id = $2 THEN 0 ELSE 1 END, service_id ASC
        LIMIT 1`,
      [businessSlug, serviceIdOrCode],
    );
    const row = result.rows[0];
    return row ? serviceFromRow(row) : undefined;
  }

  async listOfferings(
    businessSlug: string,
    serviceId: string,
  ): Promise<readonly ServiceOffering[]> {
    const result = await this.pool.query<OfferingRow>(
      `SELECT p.product_id, p.service_id, p.business_slug, p.product_code,
              p.product_name, p.description, p.status, p.revision,
              p.duration_minutes, p.priority, p.tags,
              p.price_kind, p.price_amount_minor, p.price_currency
         FROM service_products p
         JOIN service_catalog s
           ON s.business_slug = p.business_slug AND s.service_id = p.service_id
        WHERE p.business_slug = $1
          AND p.service_id = $2
          AND p.active = TRUE
          AND s.active = TRUE
        ORDER BY p.priority DESC, p.product_name ASC, p.product_id ASC`,
      [businessSlug, serviceId],
    );
    return await this.hydrateOfferings(businessSlug, result.rows);
  }

  async getOffering(
    businessSlug: string,
    offeringIdOrCode: string,
  ): Promise<ServiceOffering | undefined> {
    const result = await this.pool.query<OfferingRow>(
      `SELECT product_id, service_id, business_slug, product_code,
              product_name, description, status, revision,
              duration_minutes, priority, tags,
              price_kind, price_amount_minor, price_currency
         FROM service_products
        WHERE business_slug = $1
          AND (product_id = $2 OR product_code = $2)
        ORDER BY CASE WHEN product_id = $2 THEN 0 ELSE 1 END, product_id ASC
        LIMIT 1`,
      [businessSlug, offeringIdOrCode],
    );
    const rows = await this.hydrateOfferings(businessSlug, result.rows);
    return rows[0];
  }

  private async hydrateOfferings(
    businessSlug: string,
    rows: readonly OfferingRow[],
  ): Promise<readonly ServiceOffering[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.product_id);

    const [requirementsResult, dependenciesResult, eligibilityResult] = await Promise.all([
      this.pool.query<RequirementRow>(
        `SELECT product_id, requirement_code, requirement_kind, required, config
           FROM service_requirements
          WHERE business_slug = $1 AND product_id = ANY($2::text[])
          ORDER BY product_id ASC, requirement_code ASC`,
        [businessSlug, ids],
      ),
      this.pool.query<DependencyRow>(
        `SELECT source_product_id, target_product_id, relation
           FROM service_dependencies
          WHERE business_slug = $1 AND source_product_id = ANY($2::text[])
          ORDER BY source_product_id ASC, relation ASC, target_product_id ASC`,
        [businessSlug, ids],
      ),
      this.pool.query<EligibilityRow>(
        `SELECT product_id, mode, predicates, failure_code
           FROM service_eligibility_rules
          WHERE business_slug = $1 AND product_id = ANY($2::text[])
          ORDER BY product_id ASC`,
        [businessSlug, ids],
      ),
    ]);

    const requirementsByOffering = new Map<string, ServiceRequirement[]>();
    for (const row of requirementsResult.rows) {
      const current = requirementsByOffering.get(row.product_id) ?? [];
      current.push({
        code: row.requirement_code,
        kind: row.requirement_kind,
        required: row.required,
        config: asRecord(row.config),
      });
      requirementsByOffering.set(row.product_id, current);
    }

    const dependenciesByOffering = new Map<string, ServiceDependency[]>();
    for (const row of dependenciesResult.rows) {
      const current = dependenciesByOffering.get(row.source_product_id) ?? [];
      current.push({ relation: row.relation, targetOfferingId: row.target_product_id });
      dependenciesByOffering.set(row.source_product_id, current);
    }

    const eligibilityByOffering = new Map(
      eligibilityResult.rows.map((row) => [row.product_id, row] as const),
    );

    return rows.map((row) => {
      const eligibilityRuleSet = eligibilityFromRow(eligibilityByOffering.get(row.product_id));
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
        requirements: requirementsByOffering.get(row.product_id) ?? [],
        dependencies: dependenciesByOffering.get(row.product_id) ?? [],
        ...(eligibilityRuleSet ? { eligibilityRuleSet } : {}),
      } satisfies ServiceOffering;
    });
  }
}

let defaultPool: Pool | undefined;
let defaultRepository: PostgresServicesRepository | undefined;

export function servicesRepository(): PostgresServicesRepository {
  defaultPool ??= new Pool({ connectionString: loadRuntimeConfig().postgresUrl, max: 8 });
  defaultRepository ??= new PostgresServicesRepository(defaultPool);
  return defaultRepository;
}
