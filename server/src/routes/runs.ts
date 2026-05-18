import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { dataDir, dataPath } from '../lib/data-dir.js';
import { startPipelineRun, resumeAfterCheckpoint } from '../services/pipeline-executor.js';

export const runsRouter = Router();

export interface StepResult {
  stepId: number;
  stepName: string;
  agentId: string;
  agentName: string;
  output: string;
  outputFile?: string;
  startedAt: string;
  completedAt: string;
}

export interface Run {
  id: string;
  userId: string;
  squadId: string;
  squadName: string;
  pipelineCode: string;
  status: 'queued' | 'running' | 'checkpoint' | 'completed' | 'failed';
  currentStepId?: number;
  steps: StepResult[];
  checkpoint?: {
    stepId: number;
    description: string;
    previousStepId?: number;
  };
  error?: string;
  userInputs: Record<number, string>;
  userRequest?: string;
  // Metadados do briefing (extraídos do checkpoint 0)
  theme?: string;
  platform?: string;
  aspectRatio?: string;
  tone?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export function runsDir(userId: string): string {
  return dataDir('runs', userId);
}

export function loadRun(userId: string, runId: string): Run | null {
  const file = path.join(runsDir(userId), `${runId}.json`);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return null; }
}

export function saveRun(userId: string, run: Run): void {
  run.updatedAt = new Date().toISOString();
  fs.writeFileSync(path.join(runsDir(userId), `${run.id}.json`), JSON.stringify(run, null, 2));
}

export function listUserRuns(userId: string, squadId?: string): Run[] {
  const dir = runsDir(userId);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as Run)
    .filter(r => !squadId || r.squadId === squadId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// ── POST /api/runs — cria uma nova run ───────────────────────────────────────

runsRouter.post('/', async (req: any, res: any) => {
  const userId = req.userId;
  const companyId = req.companyId || 'default';
  const { squadId, userRequest } = req.body;

  if (!squadId) return res.status(400).json({ error: 'squadId é obrigatório' });

  // Carregar squad para verificar se tem pipeline
  const squadsDir = dataDir('squads', companyId);
  const squadFiles = fs.existsSync(squadsDir) ? fs.readdirSync(squadsDir) : [];
  const squadFile = squadFiles.find(f => f === `${squadId}.json`);
  if (!squadFile) return res.status(404).json({ error: 'Squad não encontrado' });

  const squad = JSON.parse(fs.readFileSync(path.join(squadsDir, squadFile), 'utf-8'));
  if (!squad.pipelineCode || !squad.pipelineYaml) {
    return res.status(400).json({ error: 'Este squad não tem pipeline do mw-creator' });
  }

  const run: Run = {
    id: crypto.randomUUID(),
    userId,
    squadId,
    squadName: squad.name,
    pipelineCode: squad.pipelineCode,
    status: 'queued',
    steps: [],
    userInputs: {},
    userRequest: userRequest || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveRun(userId, run);

  // Inicia execução assíncrona — não bloqueia a resposta
  startPipelineRun(userId, run.id, squad).catch((e: Error) => {
    const r = loadRun(userId, run.id);
    if (r) saveRun(userId, { ...r, status: 'failed', error: e.message });
  });

  res.status(201).json(run);
});

// ── GET /api/runs — lista runs do usuário ────────────────────────────────────

runsRouter.get('/', (req: any, res: any) => {
  const userId = req.userId;
  const { squadId } = req.query;
  res.json(listUserRuns(userId, squadId as string | undefined));
});

// ── GET /api/runs/:runId — estado atual da run ───────────────────────────────

runsRouter.get('/:runId', (req: any, res: any) => {
  const run = loadRun(req.userId, req.params.runId);
  if (!run) return res.status(404).json({ error: 'Run não encontrada' });
  res.json(run);
});

// ── POST /api/runs/:runId/checkpoint — usuário envia decisão ─────────────────

runsRouter.post('/:runId/checkpoint', async (req: any, res: any) => {
  const userId = req.userId;
  const run = loadRun(userId, req.params.runId);
  if (!run) return res.status(404).json({ error: 'Run não encontrada' });
  if (run.status !== 'checkpoint') return res.status(400).json({ error: 'Run não está em checkpoint' });

  const { decision } = req.body;
  if (!decision?.trim()) return res.status(400).json({ error: 'decision é obrigatório' });

  const checkpointStepId = run.checkpoint!.stepId;
  run.userInputs[checkpointStepId] = decision.trim();
  run.status = 'running';
  run.checkpoint = undefined;

  // Extrair metadados do briefing (checkpoint 0)
  if (checkpointStepId === 0) {
    const b = decision;
    const plat = b.match(/plataforma[:\s]+([^\n]+)/i)?.[1]?.trim();
    const fmt  = b.match(/formato[:\s]+([^\n]+)/i)?.[1]?.trim();
    const tema = b.match(/tema[:\s]+([^\n]+)/i)?.[1]?.trim();
    const tom  = b.match(/tom[:\s]+([^\n]+)/i)?.[1]?.trim();
    if (plat) run.platform = plat;
    if (fmt)  run.aspectRatio = fmt;
    if (tema) run.theme = tema;
    if (tom)  run.tone = tom;
  }
  // Extrair tema do checkpoint 2 se não veio do briefing
  if (checkpointStepId === 2 && !run.theme) {
    run.theme = decision.trim().slice(0, 80);
  }

  saveRun(userId, run);

  // Carregar squad para passar ao executor
  const squadsDir = dataDir('squads', run.userId === userId ? req.companyId || 'default' : 'default');
  let squad: any = null;
  try {
    const dir = dataDir('squads', req.companyId || 'default');
    const f = path.join(dir, `${run.squadId}.json`);
    if (fs.existsSync(f)) squad = JSON.parse(fs.readFileSync(f, 'utf-8'));
  } catch {}

  if (!squad) return res.status(500).json({ error: 'Squad não encontrado para retomar pipeline' });

  resumeAfterCheckpoint(userId, run.id, squad).catch((e: Error) => {
    const r = loadRun(userId, run.id);
    if (r) saveRun(userId, { ...r, status: 'failed', error: e.message });
  });

  res.json({ ok: true, message: 'Pipeline retomado' });
});

// ── GET /api/runs/:runId/export — download de todas as entregas em markdown ───

runsRouter.get('/:runId/export', (req: any, res: any) => {
  const run = loadRun(req.userId, req.params.runId);
  if (!run) return res.status(404).json({ error: 'Run não encontrada' });

  const theme = run.theme || run.userRequest || 'run';
  const slug = theme.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
  const date = new Date(run.createdAt).toISOString().slice(0, 10);
  const filename = `${slug}_${date}_${run.id.slice(0, 8)}.md`;

  const lines: string[] = [
    `# ${run.squadName} — ${theme}`,
    `**Run ID:** \`${run.id}\`  `,
    `**Plataforma:** ${run.platform || '—'}  `,
    `**Formato:** ${run.aspectRatio || '—'}  `,
    `**Tom:** ${run.tone || '—'}  `,
    `**Data:** ${new Date(run.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
    '',
    '---',
    '',
  ];

  // Briefing
  if (run.userInputs[0]) {
    lines.push('## Briefing\n');
    lines.push(run.userInputs[0]);
    lines.push('\n---\n');
  }

  // Outputs de cada step
  for (const step of run.steps) {
    lines.push(`## Step ${step.stepId}: ${step.stepName}`);
    lines.push(`*Agente: ${step.agentName} | ${new Date(step.completedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}*`);
    lines.push('');
    lines.push(step.output || '');
    lines.push('\n---\n');
  }

  // Decisões de checkpoint
  const decisions = Object.entries(run.userInputs).filter(([k]) => Number(k) > 0);
  if (decisions.length > 0) {
    lines.push('## Decisões nos Checkpoints\n');
    decisions.forEach(([id, dec]) => lines.push(`**Checkpoint ${id}:** ${dec}`));
  }

  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(lines.join('\n'));
});

// ── DELETE /api/runs/:runId ───────────────────────────────────────────────────

runsRouter.delete('/:runId', (req: any, res: any) => {
  const file = path.join(runsDir(req.userId), `${req.params.runId}.json`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Run não encontrada' });
  fs.unlinkSync(file);
  res.json({ ok: true });
});
