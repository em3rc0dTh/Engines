import {
  REGISTER_NEW_APPOINTMENT_OPERATION,
  REGISTER_NEW_APPOINTMENT_SCHEMA_VERSION,
  type RegisterNewAppointmentDraft,
  type RegisterNewAppointmentStartEnvelope,
} from '../contracts/register-new-appointment/index.js';

export type AppointmentCtaIssue = Readonly<{ path: string; message: string }>;
export type AppointmentCtaResult =
  | Readonly<{ ok: true; value: RegisterNewAppointmentStartEnvelope }>
  | Readonly<{ ok: false; issues: readonly AppointmentCtaIssue[] }>;

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function nonEmpty(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.trim();
  return cleaned || undefined;
}

export function adaptRegisterNewAppointmentCtaInput(
  raw: unknown,
  context: Readonly<{ channel: string }>,
): AppointmentCtaResult {
  const body = record(raw);
  if (!body) return { ok: false, issues: [{ path: '$', message: 'JSON object is required' }] };

  const issues: AppointmentCtaIssue[] = [];
  const businessSlug = nonEmpty(body.businessSlug);
  const idempotencyKey = nonEmpty(body.idempotencyKey);
  if (!businessSlug) issues.push({ path: 'businessSlug', message: 'businessSlug is required' });
  if (!idempotencyKey) issues.push({ path: 'idempotencyKey', message: 'idempotencyKey is required' });
  if (body.draft !== undefined && !record(body.draft)) {
    issues.push({ path: 'draft', message: 'draft must be an object when provided' });
  }
  if (issues.length > 0 || !businessSlug || !idempotencyKey) return { ok: false, issues };

  const correlationId = nonEmpty(body.correlationId);
  const draft = record(body.draft) as RegisterNewAppointmentDraft | undefined;
  return {
    ok: true,
    value: {
      operation: REGISTER_NEW_APPOINTMENT_OPERATION,
      businessSlug,
      schemaVersion: REGISTER_NEW_APPOINTMENT_SCHEMA_VERSION,
      ...(draft ? { draft } : {}),
      request: {
        idempotencyKey,
        ...(correlationId ? { correlationId } : {}),
        channel: context.channel,
      },
    },
  };
}
