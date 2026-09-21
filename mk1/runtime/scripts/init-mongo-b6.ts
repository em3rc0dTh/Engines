import {
  closeMongoRegistrationAuditRepository,
  ensureRegistrationAuditIndexes,
} from '../src/persistence/mongo/registration-audit.repository.js';

async function run(): Promise<void> {
  try {
    await ensureRegistrationAuditIndexes();
    console.log('B6_MONGO_AUDIT_INDEXES_OK');
  } finally {
    await closeMongoRegistrationAuditRepository();
  }
}

run().catch((error: unknown) => {
  console.error(
    `B6_MONGO_AUDIT_INDEXES_FAILED ${JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
    })}`,
  );
  process.exitCode = 1;
});
