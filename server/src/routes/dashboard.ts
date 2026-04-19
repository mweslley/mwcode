import { Router } from 'express';
import { memoryStore } from '../store.js';
import type { DashboardStats, PerformanceEntry } from '@mwcode/shared';

export const dashboardRouter = Router();

dashboardRouter.get('/estatisticas', (req, res) => {
  const companyId = req.companyId || 'default';
  const agents = [...memoryStore.agents.values()].filter(a => a.companyId === companyId);
  const tasks = [...memoryStore.tasks.values()].filter(t => t.companyId === companyId);

  const ativos = agents.filter(a => a.status === 'active');
  const concluidas = tasks.filter(t => t.status === 'completed').length;
  const custoTotal = agents.reduce((sum, a) => sum + a.hourlyRate * a.tasksCompleted, 0);
  const performanceMedia = ativos.length
    ? Math.round(ativos.reduce((sum, a) => sum + a.performance, 0) / ativos.length)
    : 0;

  const stats: DashboardStats = {
    agentesAtivos: ativos.length,
    tarefasConcluidas: concluidas,
    custoTotal,
    performanceMedia
  };
  res.json(stats);
});

dashboardRouter.get('/custos', (req, res) => {
  const companyId = req.companyId || 'default';
  const agents = [...memoryStore.agents.values()].filter(a => a.companyId === companyId);
  const byAgent = Object.fromEntries(
    agents.map(a => [a.id, a.hourlyRate * a.tasksCompleted])
  );
  const total = Object.values(byAgent).reduce((s, v) => s + v, 0);
  res.json({
    date: new Date().toISOString().slice(0, 10),
    total,
    byAgent
  });
});

dashboardRouter.get('/performance', (req, res) => {
  const companyId = req.companyId || 'default';
  const agents = [...memoryStore.agents.values()].filter(a => a.companyId === companyId);
  const result: PerformanceEntry[] = agents.map(a => ({
    agentId: a.id,
    agentName: a.name,
    performance: a.performance,
    tasksCompleted: a.tasksCompleted
  }));
  res.json(result);
});

dashboardRouter.get('/ativos', (req, res) => {
  const companyId = req.companyId || 'default';
  const agents = [...memoryStore.agents.values()].filter(a => a.companyId === companyId);
  res.json({
    ativos: agents.filter(a => a.status === 'active'),
    inativos: agents.filter(a => a.status !== 'active')
  });
});
