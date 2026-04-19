import type { FireAgentInput } from '@mwcode/shared';
import { memoryStore } from '../store.js';

export async function fireAgent(data: FireAgentInput) {
  const agent = memoryStore.agents.get(data.agentId);

  if (!agent || agent.companyId !== data.companyId) {
    throw new Error('Agente não encontrado');
  }

  const updated = {
    ...agent,
    status: 'fired' as const,
    firedAt: new Date(),
    fireReason: data.reason
  };
  memoryStore.agents.set(data.agentId, updated);

  return {
    success: true,
    agent: updated,
    tenureMs: Date.now() - agent.hiredAt.getTime()
  };
}
