import { Pool } from 'pg';
import { loadRuntimeConfig } from '../../config/runtime-config.js';
import type {
  RegistrationCommandStatus,
  RegistrationOutcomeKind,
} from '../../orchestration/temporal/activities/postgres-registration.types.js';
import type { RegistrationResult } from '../../contracts/register-new-customer/index.js';

let pool: Pool | undefined;

function db(): Pool {
  pool ??= new Pool({ connectionString: loadRuntimeConfig().postgresUrl, max: 4 });
  return pool;
}

type FinalizationRow = Readonly<{
  customer_id: string | null;
  status: RegistrationCommandStatus;
}>;

const pendingStatus: Record<RegistrationOutcomeKind, RegistrationCommandStatus> = {
  CREATED: 'CUSTOMER_CREATED_PENDING_AUDIT',
  ALREADY_EXISTS: 'EXISTING_CUSTOMER_PENDING_AUDIT',
};

const auditedStatus: Record<RegistrationOutcomeKind, RegistrationCommandStatus> = {
  CREATED: 'CUSTOMER_CREATED_AUDITED',
  ALREADY_EXISTS: 'EXISTING_CUSTOMER_AUDITED',
};

const completedStatus: Record<RegistrationOutcomeKind, RegistrationCommandStatus> = {
  CREATED: 'COMPLETED_CREATED',
  ALREADY_EXISTS: 'COMPLETED_ALREADY_EXISTS',
};

async function lockedRegistration(registrationId: string): Promise<FinalizationRow | undefined> {
  const result = await db().query<FinalizationRow>(
    `SELECT customer_id, status
       FROM registration_commands
      WHERE registration_id = $1`,
    [registrationId],
  );
  return result.rows[0];
}

export async function markRegistrationAudited(
  registrationId: string,
  customerId: string,
  outcome: RegistrationOutcomeKind,
): Promise<void> {
  const current = await lockedRegistration(registrationId);
  if (!current || current.customer_id !== customerId) {
    throw new Error('FINALIZATION_PRECONDITION_FAILED:registration/customer mismatch');
  }

  if (current.status === auditedStatus[outcome] || current.status === completedStatus[outcome]) return;
  if (current.status !== pendingStatus[outcome]) {
    throw new Error(`FINALIZATION_PRECONDITION_FAILED:unexpected status ${current.status}`);
  }

  const result = await db().query(
    `UPDATE registration_commands
        SET status = $3,
            updated_at = NOW()
      WHERE registration_id = $1
        AND customer_id = $2
        AND status = $4`,
    [registrationId, customerId, auditedStatus[outcome], pendingStatus[outcome]],
  );

  if (result.rowCount !== 1) {
    throw new Error('FINALIZATION_PRECONDITION_FAILED:audit transition lost race');
  }
}

export async function completeRegistration(
  registrationId: string,
  customerId: string,
  outcome: RegistrationOutcomeKind,
): Promise<RegistrationResult> {
  const current = await lockedRegistration(registrationId);
  if (!current || current.customer_id !== customerId) {
    throw new Error('FINALIZATION_PRECONDITION_FAILED:registration/customer mismatch');
  }

  if (current.status !== completedStatus[outcome]) {
    if (current.status !== auditedStatus[outcome]) {
      throw new Error(`FINALIZATION_PRECONDITION_FAILED:unexpected status ${current.status}`);
    }

    const result = await db().query(
      `UPDATE registration_commands
          SET status = $3,
              updated_at = NOW()
        WHERE registration_id = $1
          AND customer_id = $2
          AND status = $4`,
      [registrationId, customerId, completedStatus[outcome], auditedStatus[outcome]],
    );
    if (result.rowCount !== 1) {
      throw new Error('FINALIZATION_PRECONDITION_FAILED:completion transition lost race');
    }
  }

  return outcome === 'CREATED'
    ? { created: true, customerId }
    : { created: false, customerId, reason: 'HARD_UNIQUE' };
}

export async function closePostgresFinalizationRepository(): Promise<void> {
  const current = pool;
  pool = undefined;
  if (current) await current.end();
}
