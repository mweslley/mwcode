import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { dataDir, dataPath } from '../lib/data-dir.js';
import { startPipelineRun, resumeAfterCheckpoint } from '../services/pipeline-executor.js';

const JWT_SECRET = process.env.JWT_SECRET || 'mwcode-secret-key-change-in-production';

export const runsRouter = Router();

export interface StepResult {
  stepId: number;
  stepName: string;
  agentId: string;
  agentName: string;
  output: string;
  outputFile?: string;
  audioFile?: string;  // filename: {runId}_step{stepId}.mp3
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
  images?: string[]; // nomes dos arquivos em dataDir('images', userId)/{runId}/
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

// ── GET /api/runs/:runId/steps/:stepId/txt — download do output como .txt ────

runsRouter.get('/:runId/steps/:stepId/txt', (req: any, res: any) => {
  const run = loadRun(req.userId, req.params.runId);
  if (!run) return res.status(404).json({ error: 'Run não encontrada' });
  const step = run.steps.find(s => s.stepId === parseInt(req.params.stepId));
  if (!step) return res.status(404).json({ error: 'Step não encontrado' });
  const safeName = step.stepName.replace(/[^a-zA-Z0-9À-ÿ ]/g, '_').slice(0, 40);
  const filename = `step${step.stepId}_${safeName}.txt`;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  res.send(step.output || '');
});

// ── GET /api/runs/:runId/audio/:stepId — stream do áudio ElevenLabs ──────────

runsRouter.get('/:runId/audio/:stepId', (req: any, res: any) => {
  const { runId, stepId } = req.params;
  const audioDir = dataDir('audio', req.userId);
  const audioFile = path.join(audioDir, `${runId}_step${stepId}.mp3`);
  if (!fs.existsSync(audioFile)) return res.status(404).json({ error: 'Áudio não disponível' });
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Content-Disposition', `attachment; filename="narration_step${stepId}.mp3"`);
  fs.createReadStream(audioFile).pipe(res);
});

// ── GET /api/runs/:runId/video — stream do vídeo montado ─────────────────────

runsRouter.get('/:runId/video', (req: any, res: any) => {
  const { runId } = req.params;
  const videoDir = dataDir('videos', req.userId);
  const videoFile = path.join(videoDir, `${runId}.mp4`);
  if (!fs.existsSync(videoFile)) return res.status(404).json({ error: 'Vídeo não disponível ainda' });
  const stat = fs.statSync(videoFile);
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Content-Disposition', `inline; filename="video_${runId.slice(0, 8)}.mp4"`);
  fs.createReadStream(videoFile).pipe(res);
});

// ── GET /api/runs/:runId/images/:filename — serve imagem gerada ──────────────

runsRouter.get('/:runId/images/:filename', (req: any, res: any) => {
  const { runId, filename } = req.params;
  if (!/^[\w.-]+$/.test(filename)) return res.status(400).json({ error: 'Nome inválido' });
  // userId pode vir do authMiddleware (header) ou do token na query string (para <img src>)
  let userId = req.userId as string | undefined;
  if (!userId) {
    const t = req.query.t as string;
    if (t) {
      try {
        const payload = jwt.verify(t, JWT_SECRET) as { userId: string };
        userId = payload.userId;
      } catch { /* token inválido */ }
    }
  }
  if (!userId) return res.status(401).json({ error: 'Não autorizado' });
  const imgFile = path.join(dataDir('images', userId), runId, filename);
  if (!fs.existsSync(imgFile)) return res.status(404).json({ error: 'Imagem não encontrada' });
  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  fs.createReadStream(imgFile).pipe(res);
});

// ── DELETE /api/runs/:runId ───────────────────────────────────────────────────

runsRouter.delete('/:runId', (req: any, res: any) => {
  const file = path.join(runsDir(req.userId), `${req.params.runId}.json`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Run não encontrada' });
  fs.unlinkSync(file);
  res.json({ ok: true });
});
