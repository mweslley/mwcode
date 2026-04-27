/**
 * Dashboard — lê dados reais do sistema de arquivos (não do memoryStore).
 */
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { dataDir } from '../lib/data-dir.js';

export const dashboardRouter = Router();

interface Agent {
  id: string;
  name: string;
  role: string;
  status: 'active' | 'fired';
  performance?: number;
  tasksCompleted?: number;
  hourlyRate?: number;
  provider?: string;
  model?: string;
}

function loadAgents(userId: string): Agent[] {
  const dir = dataDir('agents', userId);
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')); } catch { return null; } })
    .filter(Boolean);
}

function countChats(userId: string): number {
  const dir = dataDir('chats', userId);
  let total = 0;
  try {
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
      const h = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
      total += (h.messages || []).filter((m: any) => m.role === 'user').length;
    }
  } catch {}
  return total;
}

function countWorkflows(userId: string): { total: number; active: number; runs: number } {
  const dir = dataDir('workflows', userId);
  let total = 0, active = 0, runs = 0;
  try {
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
      const wf = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
      total++;
      if (wf.enabled) active++;
      runs += wf.runs || 0;
    }
  } catch {}
  return { total, active, runs };
}

// GET /api/dashboard/estatisticas
dashboardRouter.get('/estatisticas', (req: any, res: any) => {
  try {
    const agents = loadAgents(req.userId);
    const ativos = agents.filter(a => a.status === 'active');
    const performanceMedia = ativos.length
      ? Math.round(ativos.reduce((s, a) => s + (a.performance || 75), 0) / ativos.length)
      : 0;
    const mensagens = countChats(req.userId);
    const wf = countWorkflows(req.userId);

    res.json({
      agentesAtivos: ativos.length,
      agentesDemitidos: agents.filter(a => a.status === 'fired').length,
      tarefasConcluidas: mensagens,
      custoTotal: 0, // sem billing por enquanto
      performanceMedia,
      workflowsTotal: wf.total,
      workflowsAtivos: wf.active,
      workflowRuns: wf.runs,
      mensagensTrocadas: mensagens,
    });
  } catch (e) {
    res.json({ agentesAtivos: 0, tarefasConcluidas: 0, custoTotal: 0, performanceMedia: 0 });
  }
});

// GET /api/dashboard/agentes — agentes com atividade recente
dashboardRouter.get('/agentes', (req: any, res: any) => {
  try {
    const agents = loadAgents(req.userId);
    res.json(agents);
  } catch {
    res.json([]);
  }
});

// GET /api/dashboard/atividade — últimas mensagens de todos os chats
dashboardRouter.get('/atividade', (req: any, res: any) => {
  try {
    const dir = dataDir('chats', req.userId);
    const activity: any[] = [];
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
      const h = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
      const last = (h.messages || []).slice(-1)[0];
      if (last) {
        activity.push({
          agentId: h.agentId,
          agentName: last.agentName || h.agentId,
          lastMessage: last.content?.slice(0, 100),
          role: last.role,
          updatedAt: h.updatedAt,
        });
      }
    }
    activity.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    res.json(activity.slice(0, 10));
  } catch {
    res.json([]);
  }
});
