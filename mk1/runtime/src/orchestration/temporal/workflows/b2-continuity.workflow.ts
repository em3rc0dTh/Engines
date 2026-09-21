import { defineQuery, setHandler, sleep, workflowInfo } from '@temporalio/workflow';

export type B2ContinuityInput = Readonly<{
  probeId: string;
  delayMs: number;
}>;

export type B2ContinuityPhase = 'STARTING' | 'WAITING_ON_TEMPORAL_TIMER' | 'COMPLETED';

export type B2ContinuityState = Readonly<{
  phase: B2ContinuityPhase;
  probeId: string;
  workflowId: string;
  runId: string;
  taskQueue: string;
  delayMs: number;
}>;

export type B2ContinuityResult = Readonly<{
  ok: true;
  phase: 'COMPLETED';
  probeId: string;
  workflowId: string;
  runId: string;
  taskQueue: string;
  delayMs: number;
}>;

export const b2ContinuityStateQuery = defineQuery<B2ContinuityState>('GetB2ContinuityState');

export async function b2ContinuitySmoke(input: B2ContinuityInput): Promise<B2ContinuityResult> {
  const info = workflowInfo();
  let phase: B2ContinuityPhase = 'STARTING';

  const state = (): B2ContinuityState => ({
    phase,
    probeId: input.probeId,
    workflowId: info.workflowId,
    runId: info.runId,
    taskQueue: info.taskQueue,
    delayMs: input.delayMs,
  });

  setHandler(b2ContinuityStateQuery, state);

  phase = 'WAITING_ON_TEMPORAL_TIMER';
  await sleep(input.delayMs);
  phase = 'COMPLETED';

  return {
    ok: true,
    phase: 'COMPLETED',
    probeId: input.probeId,
    workflowId: info.workflowId,
    runId: info.runId,
    taskQueue: info.taskQueue,
    delayMs: input.delayMs,
  };
}
