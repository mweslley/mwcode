export interface DashboardStats {
  agentesAtivos: number;
  tarefasConcluidas: number;
  custoTotal: number;
  performanceMedia: number;
}

export interface CostEntry {
  date: string;
  total: number;
  byAgent: Record<string, number>;
}

export interface PerformanceEntry {
  agentId: string;
  agentName: string;
  performance: number;
  tasksCompleted: number;
}
