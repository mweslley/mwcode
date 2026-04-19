export type AdapterName = 'openai' | 'openrouter' | 'gemini' | 'ollama' | 'api' | 'github' | 'deepseek';

export type AgentStatus = 'active' | 'inactive' | 'fired';

export interface Agent {
  id: string;
  companyId: string;
  name: string;
  role: string;
  adapter: AdapterName;
  model: string;
  skills: string[];
  status: AgentStatus;
  hiredAt: Date;
  firedAt?: Date | null;
  fireReason?: string | null;
  performance: number;
  tasksCompleted: number;
  hourlyRate: number;
  metadata?: Record<string, unknown>;
}

export interface HireAgentInput {
  companyId: string;
  name: string;
  role: string;
  adapter: AdapterName;
  model: string;
  skills?: string[];
  salary?: number;
}

export interface FireAgentInput {
  agentId: string;
  companyId: string;
  reason: string;
}

export interface AdapterResponse {
  content: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  model?: string;
}

export interface Adapter {
  name: AdapterName;
  model: string;
  call(prompt: string, context?: Record<string, unknown>): Promise<AdapterResponse>;
  detectModel?(response: string): string | null;
}
