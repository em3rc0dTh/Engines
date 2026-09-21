export type RuntimeConfig = Readonly<{
  temporalAddress: string;
  temporalNamespace: string;
  temporalTaskQueue: string;
  postgresUrl: string;
  mongoUrl: string;
  mongoDb: string;
  attachmentStoreRoot: string;
}>;

export function loadRuntimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  return {
    temporalAddress: env.TEMPORAL_ADDRESS ?? 'localhost:7233',
    temporalNamespace: env.TEMPORAL_NAMESPACE ?? 'default',
    temporalTaskQueue: env.TEMPORAL_TASK_QUEUE ?? 'engines-mk0-registration',
    postgresUrl: env.POSTGRES_URL ?? 'postgresql://engines:engines@localhost:5432/engines_mk0',
    mongoUrl: env.MONGO_URL ?? 'mongodb://localhost:27017',
    mongoDb: env.MONGO_DB ?? 'engines_mk0',
    attachmentStoreRoot: env.ATTACHMENT_STORE_ROOT ?? '/tmp/engines-mk0-attachment-store',
  };
}
