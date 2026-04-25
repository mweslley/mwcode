const BASE = '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Erro ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ status: string; version: string }>('/health'),
  
  // AUTH
  post: <T = any>(path: string, data: any) => 
    request<T>(path, { method: 'POST', body: JSON.stringify(data) }),
  get: <T = any>(path: string) => request<T>(path),
  put: <T = any>(path: string, data: any) => 
    request<T>(path, { method: 'PUT', body: JSON.stringify(data) }),
  delete: <T = any>(path: string) => request<T>(path, { method: 'DELETE' }),

  listCompanies: () => request<any[]>('/empresas'),
  createCompany: (data: any) => request('/empresas', { method: 'POST', body: JSON.stringify(data) }),

  listAgents: () => request<any[]>('/agentes'),
  hireAgent: (data: any) => request('/agentes', { method: 'POST', body: JSON.stringify(data) }),
  fireAgent: (id: string, reason: string) =>
    request(`/agentes/${id}`, { method: 'DELETE', body: JSON.stringify({ reason }) }),

  sendChatSingle: (data: { mensagem: string; adapter?: string; model?: string }) =>
    request<{ resposta: string; modelo?: string; uso?: any }>('/chat/single', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  sendChat: (agentId: string, mensagem: string) =>
    request<{ resposta: string; chatId: string }>(`/chat/${agentId}`, {
      method: 'POST',
      body: JSON.stringify({ mensagem })
    }),
  chatHistory: (agentId: string) => request<any[]>(`/chat/${agentId}`),

  dashboardStats: () => request<any>('/dashboard/estatisticas'),
  dashboardCosts: () => request<any>('/dashboard/custos'),
  dashboardPerformance: () => request<any[]>('/dashboard/performance'),

  listTasks: () => request<any[]>('/tarefas'),
  createTask: (data: any) => request('/tarefas', { method: 'POST', body: JSON.stringify(data) })
};
