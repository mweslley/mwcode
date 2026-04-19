import { nanoid } from 'nanoid';
import type { Agent, HireAgentInput } from '@mwcode/shared';
import { memoryStore } from '../store.js';

export async function hireAgent(data: HireAgentInput): Promise<Agent> {
  const agent: Agent = {
    id: `agent_${nanoid(10)}`,
    companyId: data.companyId,
    name: data.name,
    role: data.role,
    adapter: data.adapter,
    model: data.model,
    skills: data.skills ?? [],
    status: 'active',
    hiredAt: new Date(),
    firedAt: null,
    fireReason: null,
    performance: 0,
    tasksCompleted: 0,
    hourlyRate: data.salary ?? 0
  };
  memoryStore.agents.set(agent.id, agent);
  return agent;
}

export async function listAgents(companyId: string): Promise<Agent[]> {
  return [...memoryStore.agents.values()].filter(a => a.companyId === companyId);
}

export async function getAgent(agentId: string, companyId: string): Promise<Agent | null> {
  const agent = memoryStore.agents.get(agentId);
  if (!agent || agent.companyId !== companyId) return null;
  return agent;
}
