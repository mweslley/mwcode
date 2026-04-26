import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { dataDir, dataPath } from '../lib/data-dir.js';

export const workflowsRouter = Router();

interface WorkflowStep {
  type: 'trigger' | 'agent' | 'action';
  label: string;
  config?: Record<string, string>;
}

interface Workflow {
  id: string;
  userId: string;
  name: string;
  description: string;
  enabled: boolean;
  triggerType: string;
  triggerConfig: string;
  agentIds: string[];
  actionType: string;
  actionConfig: string;
  steps: WorkflowStep[];
  runs: number;
  lastRun?: string;
  createdAt: string;
}

function wfDir(userId: string): string {
  return dataDir('workflows', userId);
}

function loadWorkflows(userId: string): Workflow[] {
  const dir = wfDir(userId);
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')); }
      catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function saveWorkflow(userId: string, wf: Workflow): void {
  const dir = wfDir(userId);
  fs.writeFileSync(path.join(dir, `${wf.id}.json`), JSON.stringify(wf, null, 2));
}

// GET /api/workflows
workflowsRouter.get('/', (req: any, res: any) => {
  try {
    const workflows = loadWorkflows(req.userId);
    res.json(workflows);
  } catch {
    res.json([]);
  }
});

// POST /api/workflows
workflowsRouter.post('/', (req: any, res: any) => {
  const { name, description, triggerType, triggerConfig, agentIds, actionType, actionConfig } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

  const wf: Workflow = {
    id: crypto.randomUUID(),
    userId: req.userId,
    name,
    description: description || '',
    enabled: false,
    triggerType: triggerType || 'manual',
    triggerConfig: triggerConfig || '',
    agentIds: agentIds ? agentIds.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
    actionType: actionType || 'message',
    actionConfig: actionConfig || '',
    steps: [],
    runs: 0,
    createdAt: new Date().toISOString(),
  };

  // Montar steps para visualização
  wf.steps = [
    { type: 'trigger', label: triggerType === 'schedule' ? `⏰ ${triggerConfig || 'Agendado'}` : triggerType === 'webhook' ? '🌐 Webhook' : '▶️ Manual' },
    { type: 'agent', label: agentIds ? '🤖 Agentes' : '✨ Assistente Geral' },
    { type: 'action', label: actionType === 'discord' ? '🎮 Discord' : actionType === 'webhook' ? '🌐 Webhook' : '💬 Mensagem' },
  ];

  saveWorkflow(req.userId, wf);
  res.json(wf);
});

// PUT /api/workflows/:id
workflowsRouter.put('/:id', (req: any, res: any) => {
  const file = path.join(wfDir(req.userId), `${req.params.id}.json`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Não encontrado' });

  const existing = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const updated = { ...existing, ...req.body };
  fs.writeFileSync(file, JSON.stringify(updated, null, 2));
  res.json(updated);
});

// DELETE /api/workflows/:id
workflowsRouter.delete('/:id', (req: any, res: any) => {
  const file = path.join(wfDir(req.userId), `${req.params.id}.json`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  res.json({ ok: true });
});

// POST /api/workflows/:id/run — executa manualmente
workflowsRouter.post('/:id/run', async (req: any, res: any) => {
  const file = path.join(wfDir(req.userId), `${req.params.id}.json`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Não encontrado' });

  const wf: Workflow = JSON.parse(fs.readFileSync(file, 'utf-8'));
  wf.runs = (wf.runs || 0) + 1;
  wf.lastRun = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(wf, null, 2));

  // TODO: executar agentes em sequência conforme wf.agentIds
  res.json({ ok: true, message: `Workflow "${wf.name}" executado`, runs: wf.runs });
});
