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

async function downloadBlob(apiPath: string, fallbackName: string): Promise<void> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${BASE}${apiPath}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  if (!res.ok) throw new Error(`Download falhou (${res.status})`);
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') || '';
  const nameMatch = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)/i);
  const filename = nameMatch ? decodeURIComponent(nameMatch[1].replace(/["']/g, '')) : fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

export const api = {
  downloadRun: (runId: string) => downloadBlob(`/runs/${runId}/export`, `run-${runId}.md`),
  downloadStepTxt: (runId: string, stepId: number, stepName: string) =>
    downloadBlob(`/runs/${runId}/steps/${stepId}/txt`, `step${stepId}_${stepName}.txt`),
  downloadAudio: (runId: string, stepId: number) =>
    downloadBlob(`/runs/${runId}/audio/${stepId}`, `narration_step${stepId}.mp3`),
  downloadVideo: (runId: string) => downloadBlob(`/runs/${runId}/video`, `video_${runId.slice(0, 8)}.mp4`),
  fetchVideoUrl: async (runId: string): Promise<string> => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${BASE}/runs/${runId}/video`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    });
    if (!res.ok) throw new Error(res.status === 404 ? 'Vídeo não disponível ainda' : `Erro ${res.status}`);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },
  // URL de imagem com token embutido na query (para uso em <img src>)
  imageUrl: (runId: string, filename: string): string => {
    const token = localStorage.getItem('token') || '';
    return `${BASE}/runs/${runId}/images/${filename}?t=${encodeURIComponent(token)}`;
  },
  health: () => request<{ status: string; version: string }>('/health'),
  
  // AUTH
  post: <T = any>(path: string, data: any) => 
    request<T>(path, { method: 'POST', body: JSON.stringify(data) }),
  get: <T = any>(path: string) => request<T>(path),
  put: <T = any>(path: string, data: any) => 
    request<T>(path, { method: 'PUT', body: JSON.stringify(data) }),
  delete: <T = any>(path: string, data?: any) =>
    request<T>(path, { method: 'DELETE', ...(data ? { body: JSON.stringify(data) } : {}) }),

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
