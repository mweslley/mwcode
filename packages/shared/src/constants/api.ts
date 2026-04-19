export const API_BASE_PATH = '/api';

export const API_PORT = 3100;

export const ROUTES = {
  HEALTH: '/api/health',
  EMPRESAS: '/api/empresas',
  AGENTES: '/api/agentes',
  CHAT: '/api/chat',
  DASHBOARD: '/api/dashboard',
  TAREFAS: '/api/tarefas'
} as const;

export const OPENROUTER_MODELS = {
  gpt4o: 'openai/gpt-4o',
  gpt4o_mini: 'openai/gpt-4o-mini',
  gemini15: 'google/gemini-pro-1.5',
  gemini15_flash: 'google/gemini-flash-1.5-8b',
  llama31: 'meta-llama/llama-3.1-70b-instruct',
  llama31_8b: 'meta-llama/llama-3.1-8b-instruct',
  mistral: 'mistralai/mistral-7b-instruct',
  mixtral: 'mistralai/mixtral-8x7b-instruct',
  qwen25: 'qwen/qwen-2.5-72b-instruct',
  qwen25_coder: 'qwen/qwen-2.5-coder-32b-instruct',
  deepseek: 'deepseek/deepseek-chat',
  free: 'openrouter/auto'
} as const;

export const DEFAULT_FAILOVER_ORDER = [
  'openrouter/auto',
  'qwen/qwen-2.5-coder-32b-instruct',
  'mistralai/mistral-7b-instruct'
];
