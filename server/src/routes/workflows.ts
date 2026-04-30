import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { dataDir, dataPath } from '../lib/data-dir.js';
import { sendMessageToAgent } from '../lib/agent-chat.js';

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

function buildSteps(triggerType: string, triggerConfig: string, agentIds: string, actionType: string): WorkflowStep[] {
  return [
    { type: 'trigger', label: triggerType === 'schedule' ? `⏰ ${triggerConfig || 'Agendado'}` : triggerType === 'webhook' ? '🌐 Webhook' : '▶️ Manual' },
    { type: 'agent', label: agentIds ? '🤖 Agentes' : '✨ Assistente Geral' },
    { type: 'action', label: actionType === 'discord' ? '🎮 Discord' : actionType === 'webhook' ? '🌐 Webhook' : '💬 Mensagem' },
  ];
}

// GET /api/workflows
workflowsRouter.get('/', (req: any, res: any) => {
  try { res.json(loadWorkflows(req.userId)); } catch { res.json([]); }
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
    steps: buildSteps(triggerType || 'manual', triggerConfig || '', agentIds || '', actionType || 'message'),
    runs: 0,
    createdAt: new Date().toISOString(),
  };

  saveWorkflow(req.userId, wf);
  res.json(wf);
});

// PUT /api/workflows/:id
workflowsRouter.put('/:id', (req: any, res: any) => {
  const file = path.join(wfDir(req.userId), `${req.params.id}.json`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Não encontrado' });

  const existing: Workflow = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const updated: Workflow = { ...existing, ...req.body, id: existing.id, userId: req.userId };

  // Recalcula agentIds se veio como string
  if (typeof req.body.agentIds === 'string') {
    updated.agentIds = req.body.agentIds.split(',').map((s: string) => s.trim()).filter(Boolean);
  }

  // Recalcula steps com os novos valores
  const tt = updated.triggerType || existing.triggerType;
  const tc = updated.triggerConfig || existing.triggerConfig;
  const ai = updated.agentIds?.join(',') || '';
  const at = updated.actionType || existing.actionType;
  updated.steps = buildSteps(tt, tc, ai, at);

  fs.writeFileSync(file, JSON.stringify(updated, null, 2));
  res.json(updated);
});

// DELETE /api/workflows/:id
workflowsRouter.delete('/:id', (req: any, res: any) => {
  const file = path.join(wfDir(req.userId), `${req.params.id}.json`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  res.json({ ok: true });
});

// POST /api/workflows/:id/run — executa manualmente chamando a IA de verdade
workflowsRouter.post('/:id/run', async (req: any, res: any) => {
  const file = path.join(wfDir(req.userId), `${req.params.id}.json`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Não encontrado' });

  const wf: Workflow = JSON.parse(fs.readFileSync(file, 'utf-8'));
  wf.runs = (wf.runs || 0) + 1;
  wf.lastRun = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(wf, null, 2));

  const results: { agentId: string; agentName: string; preview: string }[] = [];
  const triggerMsg =
    `[Rotina: ${wf.name}] Sua tarefa agendada foi acionada agora.\n` +
    `${wf.description ? `Descrição: ${wf.description}\n` : ''}` +
    `Execute sua tarefa e reporte o resultado de forma clara e objetiva.`;

  for (const agentId of wf.agentIds) {
    try {
      const r = await sendMessageToAgent(req.userId, agentId, triggerMsg, { source: `Rotina: ${wf.name}` });
      results.push({ agentId: r.agentId, agentName: r.agentName, preview: r.content.slice(0, 200) });
    } catch (e: any) {
      results.push({ agentId, agentName: agentId, preview: `Erro: ${e.message}` });
    }
  }

  // Se não há agentes configurados, usa o assistente geral
  if (wf.agentIds.length === 0) {
    results.push({ agentId: 'none', agentName: '—', preview: 'Nenhum agente configurado nesta rotina.' });
  }

  res.json({ ok: true, message: `Rotina "${wf.name}" executada`, runs: wf.runs, results });
});

// ── Scheduler de cron ───────────────────────────────────────────────────────

function matchCronField(field: string, value: number): boolean {
  if (field === '*') return true;
  if (field.includes(',')) return field.split(',').map(Number).includes(value);
  if (field.includes('-')) {
    const [from, to] = field.split('-').map(Number);
    return value >= from && value <= to;
  }
  if (field.includes('/')) {
    const [base, step] = field.split('/');
    if (base === '*') return value % parseInt(step) === 0;
    return parseInt(base) === value;
  }
  return parseInt(field) === value;
}

function cronMatches(cron: string, date: Date): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [min, hour, , , dow] = parts;
  return (
    matchCronField(min, date.getUTCMinutes()) &&
    matchCronField(hour, date.getUTCHours()) &&
    matchCronField(dow, date.getUTCDay())
  );
}

function getAllUserIds(): string[] {
  const usersFile = dataPath('users.json');
  if (!fs.existsSync(usersFile)) return [];
  try {
    const users = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
    return (users || []).map((u: any) => u.id).filter(Boolean);
  } catch { return []; }
}

export function startWorkflowScheduler(): void {
  // Checa a cada minuto se alguma rotina agendada deve rodar
  setInterval(async () => {
    const now = new Date();
    for (const userId of getAllUserIds()) {
      let workflows: Workflow[] = [];
      try { workflows = loadWorkflows(userId); } catch { continue; }

      for (const wf of workflows) {
        if (!wf.enabled || wf.triggerType !== 'schedule' || !wf.triggerConfig) continue;
        if (!cronMatches(wf.triggerConfig, now)) continue;

        // Evita rodar duas vezes no mesmo minuto
        if (wf.lastRun) {
          const diff = now.getTime() - new Date(wf.lastRun).getTime();
          if (diff < 90_000) continue; // menos de 90s = já rodou neste minuto
        }

        console.log(`[Scheduler] Executando rotina "${wf.name}" para userId ${userId}`);
        wf.runs = (wf.runs || 0) + 1;
        wf.lastRun = now.toISOString();
        saveWorkflow(userId, wf);

        const triggerMsg =
          `[Rotina: ${wf.name}] Sua tarefa agendada foi acionada automaticamente.\n` +
          `${wf.description ? `Descrição: ${wf.description}\n` : ''}` +
          `Execute e reporte o resultado.`;

        for (const agentId of wf.agentIds) {
          sendMessageToAgent(userId, agentId, triggerMsg, { source: `Rotina: ${wf.name}` })
            .catch(e => console.error(`[Scheduler] Erro ao chamar agente ${agentId}:`, e.message));
        }
      }
    }
  }, 60_000);

  console.log('[MWCode] Scheduler de rotinas iniciado (verifica a cada 1 min)');
}
