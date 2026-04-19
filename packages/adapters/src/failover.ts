import type { Adapter, AdapterResponse } from '@mwcode/shared';

export interface FailoverOptions {
  adapters: Adapter[];
  onFailure?: (adapter: Adapter, error: unknown) => void;
}

export const createFailoverAdapter = (opts: FailoverOptions): Adapter => {
  if (opts.adapters.length === 0) {
    throw new Error('Failover precisa de pelo menos 1 adapter');
  }

  const primary = opts.adapters[0];

  return {
    name: primary.name,
    model: primary.model,

    async call(prompt: string, context?: Record<string, unknown>): Promise<AdapterResponse> {
      let lastError: unknown;
      for (const adapter of opts.adapters) {
        try {
          const result = await adapter.call(prompt, context);
          return result;
        } catch (error) {
          lastError = error;
          opts.onFailure?.(adapter, error);
          console.warn(`[failover] ${adapter.name}/${adapter.model} falhou:`, (error as Error).message);
        }
      }
      throw new Error(`Todos os provedores falharam. Último erro: ${(lastError as Error)?.message}`);
    }
  };
};
