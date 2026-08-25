import { workflowInfo } from '@temporalio/workflow';

export type B0SmokeInput = Readonly<{
  probeId: string;
}>;

export type B0SmokeResult = Readonly<{
  ok: true;
  probeId: string;
  workflowId: string;
  runId: string;
  taskQueue: string;
}>;

export async function b0RuntimeSmoke(input: B0SmokeInput): Promise<B0SmokeResult> {
  const info = workflowInfo();

  return {
    ok: true,
    probeId: input.probeId,
    workflowId: info.workflowId,
    runId: info.runId,
    taskQueue: info.taskQueue,
  };
}
