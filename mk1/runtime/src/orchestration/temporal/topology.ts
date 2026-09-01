import type { RuntimeConfig } from '../../config/runtime-config.js';

export type TemporalTopology = Readonly<{
  address: string;
  namespace: string;
  taskQueue: string;
  workerRole: 'mk0-orchestration-worker';
}>;

export function temporalTopologyFrom(config: RuntimeConfig): TemporalTopology {
  return {
    address: config.temporalAddress,
    namespace: config.temporalNamespace,
    taskQueue: config.temporalTaskQueue,
    workerRole: 'mk0-orchestration-worker',
  };
}

export function assertMk0TemporalTopology(topology: TemporalTopology): void {
  if (!topology.address.trim()) throw new Error('Temporal address is required');
  if (!topology.namespace.trim()) throw new Error('Temporal namespace is required');
  if (!topology.taskQueue.trim()) throw new Error('Temporal taskQueue is required');
  if (topology.taskQueue !== 'engines-mk0-registration') {
    throw new Error(`Unexpected mk0 Task Queue: ${topology.taskQueue}`);
  }
}
