import { Pool, type PoolConfig } from 'pg';

export function createResilientPostgresPool(
  config: PoolConfig,
  component: string,
): Pool {
  const pool = new Pool(config);
  pool.on('error', (error) => {
    console.warn(JSON.stringify({
      event: 'POSTGRES_POOL_BACKGROUND_ERROR',
      component,
      code: typeof (error as Error & { code?: unknown }).code === 'string'
        ? (error as Error & { code?: string }).code
        : undefined,
      message: error.message,
      recoverable: true,
    }));
  });
  return pool;
}
