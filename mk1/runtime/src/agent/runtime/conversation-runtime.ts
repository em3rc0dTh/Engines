import type {
  AgentRuntimeExecution,
  AgentRuntimeMessageInput,
  AgentRuntimeStore,
  AgentRuntimeWorkerResult,
} from './types.js';

export class AgentRuntimeReplayFailureError extends Error {
  constructor(readonly code: string) {
    super('AGENT_RUNTIME_REPLAY_FAILED:' + code);
    this.name = 'AgentRuntimeReplayFailureError';
  }
}

function errorCode(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message.split(':')[0] || 'AGENT_RUNTIME_FAILED';
  }
  return 'AGENT_RUNTIME_FAILED';
}

export class AgentConversationRuntime {
  constructor(
    private readonly store: AgentRuntimeStore,
    private readonly maxConversationTurns = 8,
  ) {
    if (!Number.isInteger(maxConversationTurns) || maxConversationTurns < 0 || maxConversationTurns > 8) {
      throw new Error('AGENT_RUNTIME_CONTEXT_LIMIT_INVALID');
    }
  }

  async execute<T>(
    input: AgentRuntimeMessageInput,
    worker: (context: Readonly<{ recentTurns: readonly import('../../contracts/agent-layer/index.js').AgentConversationTurn[] }>) =>
      Promise<AgentRuntimeWorkerResult<T>>,
  ): Promise<AgentRuntimeExecution<T>> {
    const claim = await this.store.claim(input);

    if (claim.kind === 'REPLAY_FAILED') {
      throw new AgentRuntimeReplayFailureError(claim.errorCode);
    }

    if (claim.kind === 'REPLAY_APPLIED') {
      return {
        value: claim.response as T,
        replayed: true,
        audit: {
          route: claim.route,
          modelInvoked: claim.modelInvoked,
          contextTurnCount: claim.contextTurnCount,
          ...(claim.enginePhaseBefore ? { enginePhaseBefore: claim.enginePhaseBefore } : {}),
          ...(claim.enginePhaseAfter ? { enginePhaseAfter: claim.enginePhaseAfter } : {}),
        },
      };
    }

    const recentTurns = await this.store.recentTurns({
      businessSlug: input.businessSlug,
      channel: input.channel,
      externalConversationId: input.externalConversationId,
      excludeExternalMessageId: input.externalMessageId,
      maxConversationTurns: this.maxConversationTurns,
    });

    try {
      const result = await worker({ recentTurns });
      const audit = {
        ...result.audit,
        contextTurnCount: recentTurns.length,
      };

      await this.store.complete({
        message: input,
        response: result.value,
        reply: result.reply,
        route: audit.route,
        modelInvoked: audit.modelInvoked,
        contextTurnCount: audit.contextTurnCount,
        ...(audit.interpretation ? { interpretation: audit.interpretation } : {}),
        ...(audit.enginePhaseBefore ? { enginePhaseBefore: audit.enginePhaseBefore } : {}),
        ...(audit.enginePhaseAfter ? { enginePhaseAfter: audit.enginePhaseAfter } : {}),
      });

      return {
        value: result.value,
        replayed: false,
        audit,
      };
    } catch (error) {
      await this.store.fail({
        message: input,
        errorCode: errorCode(error),
      });
      throw error;
    }
  }
}
