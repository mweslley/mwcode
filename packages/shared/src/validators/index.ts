import type { AdapterName, HireAgentInput, FireAgentInput } from '../types/agent.js';
import type { CreateCompanyInput } from '../types/company.js';
import type { SendMessageInput } from '../types/chat.js';

const VALID_ADAPTERS: AdapterName[] = [
  'openai', 'openrouter', 'gemini', 'ollama', 'api', 'github', 'deepseek'
];

export function validateHireAgent(data: unknown): HireAgentInput {
  const d = data as Partial<HireAgentInput>;
  if (!d.companyId) throw new Error('companyId obrigatório');
  if (!d.name) throw new Error('name obrigatório');
  if (!d.role) throw new Error('role obrigatório');
  if (!d.adapter || !VALID_ADAPTERS.includes(d.adapter)) throw new Error('adapter inválido');
  if (!d.model) throw new Error('model obrigatório');
  return {
    companyId: d.companyId,
    name: d.name,
    role: d.role,
    adapter: d.adapter,
    model: d.model,
    skills: d.skills ?? [],
    salary: d.salary ?? 0
  };
}

export function validateFireAgent(data: unknown): FireAgentInput {
  const d = data as Partial<FireAgentInput>;
  if (!d.agentId) throw new Error('agentId obrigatório');
  if (!d.companyId) throw new Error('companyId obrigatório');
  if (!d.reason) throw new Error('reason obrigatório');
  return d as FireAgentInput;
}

export function validateCreateCompany(data: unknown): CreateCompanyInput {
  const d = data as Partial<CreateCompanyInput>;
  if (!d.name) throw new Error('name obrigatório');
  return { name: d.name, plan: d.plan ?? 'free', budget: d.budget ?? 0 };
}

export function validateSendMessage(data: unknown): SendMessageInput {
  const d = data as Partial<SendMessageInput>;
  if (!d.agentId) throw new Error('agentId obrigatório');
  if (!d.companyId) throw new Error('companyId obrigatório');
  if (!d.userId) throw new Error('userId obrigatório');
  if (!d.message) throw new Error('message obrigatório');
  return d as SendMessageInput;
}
