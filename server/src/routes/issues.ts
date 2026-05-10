import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { dataPath, dataDir, DATA_DIR } from '../lib/data-dir.js';
import { notifyCEOTaskComplete } from '../services/agent-loop.js';

export const issuesRouter = Router();

export type IssueStatus = 'backlog' | 'todo' | 'em_progresso' | 'em_revisao' | 'concluido' | 'cancelado';
export type IssuePriority = 'critico' | 'alto' | 'medio' | 'baixo';
export type ApprovalType = 'contratar' | 'foco' | 'geral';

export interface LogEntry {
  ts: string;
  msg: string;
  ok?: boolean;
}

export interface Issue {
  id: string;
  userId: string;
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
  assigneeAgentId?: string;
  assigneeAgentName?: string;
  createdByAgentId?: string;
  createdByAgentName?: string;
  parentId?: string;
  requiresApproval: boolean;
  approvalStatus?: 'pendente' | 'aprovado' | 'rejeitado';
  approvalNote?: string;
  approvalType?: ApprovalType;
  hireData?: { name: string; role: string; instructions: string; model: string };
  focusData?: { mission?: string; goals?: string[] };
  workflowId?: string;
  paused?: boolean;
  logs?: LogEntry[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// ── Corpo de funções corporativas p/ criação de agente aprovado ───────────────

const CORPORATE_ROLES: Record<string, string> = {
  'COO': 'Chief Operating Officer — Diretor de Operações. Responsável pela execução operacional: operações, logística, atendimento e produção.',
  'CFO': 'Chief Financial Officer — Diretor Financeiro. Responsável por finanças, orçamento, contabilidade, controladoria e auditoria.',
  'CTO': 'Chief Technology Officer — Diretor de Tecnologia. Responsável por engenharia de software, infraestrutura, DevOps, segurança e arquitetura.',
  'CIO': 'Chief Information Officer — Diretor de TI. Responsável por sistemas internos, help desk, redes e governança de TI.',
  'CMO': 'Chief Marketing Officer — Diretor de Marketing. Responsável por branding, performance, conteúdo, social media e growth.',
  'CPO': 'Chief Product Officer — Diretor de Produto. Responsável por estratégia de produto, UX/UI, pesquisa e product design.',
  'CHRO': 'Chief Human Resources Officer — Diretor de RH. Responsável por recrutamento, people ops, treinamento e cultura.',
  'CCO': 'Chief Commercial Officer — Diretor Comercial. Responsável por vendas, customer success, parcerias e expansão.',
  'CRO': 'Chief Revenue Officer — Diretor de Receita. Responsável por revenue operations e crescimento financeiro.',
  'CISO': 'Chief Information Security Officer — Diretor de Segurança. Responsável por cibersegurança e compliance.',
  'CLO': 'Chief Legal Officer — Diretor Jurídico. Responsável por compliance legal, contratos e governança.',
};

function createAgentFromHireData(
  userId: string,
  hire: { name: string; role: string; instructions: string; model: string }
): string {
  const id = crypto.randomUUID();
  const roleKey = Object.keys(CORPORATE_ROLES).find(k => k.toLowerCase() === hire.name.toLowerCase());
  const roleDescription = roleKey ? CORPORATE_ROLES[roleKey] : (hire.role || hire.name);
  const agent = {
    id, userId,
    name: hire.name,
    role: hire.role || roleDescription,
    personality:
      `IMPORTANTE: Responda SEMPRE em português brasileiro. Nunca use inglês.\n\n` +
      `Você é ${hire.name} — ${roleDescription}\n\n` +
      (hire.instructions ? `## Suas instruções (definidas pelo CEO)\n${hire.instructions}\n\n` : '') +
      `## Regras de operação\n` +
      `- Você não toma decisões estratégicas por conta própria — consulte o CEO quando necessário\n` +
      `- Ao concluir, reporte ao CEO: o que foi feito, resultados obtidos e próximos passos sugeridos\n` +
      `- Decisões irreversíveis ou de alto impacto: sinalize [APROVAÇÃO NECESSÁRIA] antes de agir`,
    goals: [],
    skills: [],
    model: hire.model || 'openrouter/auto',
    provider: 'openrouter',
    status: 'active',
    hireDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    createdBy: 'CEO (aprovado pelo usuário)',
  };
  const dir = dataDir('agents', userId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(agent, null, 2));
  return id;
}

function updateCompanyFocus(userId: string, focusData: { mission?: string; goals?: string[] }): void {
  const file = path.join(DATA_DIR, `${userId}.json`);
  if (!fs.existsSync(file)) return;
  try {
    const company = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (focusData.mission !== undefined) company.mission = focusData.mission;
    if (focusData.goals !== undefined) company.goals = focusData.goals;
    company.updatedAt = new Date().toISOString();
    fs.writeFileSync(file, JSON.stringify(company, null, 2));
  } catch {}
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function issuesFile(userId: string): string {
  dataDir('issues');
  return dataPath('issues', `${userId}.json`);
}

function loadIssues(userId: string): Issue[] {
  const file = issuesFile(userId);
  if (!fs.existsSync(file)) return [];
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return []; }
}

function saveIssues(userId: string, issues: Issue[]): void {
  fs.writeFileSync(issuesFile(userId), JSON.stringify(issues, null, 2));
}

function addLog(issue: Issue, msg: string, ok = true): void {
  if (!issue.logs) issue.logs = [];
  issue.logs.push({ ts: new Date().toISOString(), msg, ok });
}

// ── Rotas ─────────────────────────────────────────────────────────────────────

// GET /api/issues
issuesRouter.get('/', (req: any, res: any) => {
  const { status, assignee, approval } = req.query;
  let issues = loadIssues(req.userId);
  if (status) issues = issues.filter(i => i.status === status);
  if (assignee) issues = issues.filter(i => i.assigneeAgentId === assignee);
  if (approval === 'pendente') issues = issues.filter(i => i.requiresApproval && i.approvalStatus === 'pendente');
  res.json(issues.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
});

// GET /api/issues/inbox — itens pendentes de aprovação
issuesRouter.get('/inbox', (req: any, res: any) => {
  const issues = loadIssues(req.userId).filter(
    i => i.requiresApproval && i.approvalStatus === 'pendente'
  );
  res.json(issues.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
});

// GET /api/issues/count/inbox — badge count
issuesRouter.get('/count/inbox', (req: any, res: any) => {
  const count = loadIssues(req.userId).filter(
    i => i.requiresApproval && i.approvalStatus === 'pendente'
  ).length;
  res.json({ count });
});

// POST /api/issues
issuesRouter.post('/', (req: any, res: any) => {
  const { title, description, status, priority, assigneeAgentId, assigneeAgentName,
          createdByAgentId, createdByAgentName, parentId, requiresApproval, workflowId,
          approvalType, hireData, focusData } = req.body;
  if (!title) return res.status(400).json({ error: 'Título é obrigatório' });

  const issue: Issue = {
    id: crypto.randomUUID(),
    userId: req.userId,
    title,
    description: description || '',
    status: status || 'todo',
    priority: priority || 'medio',
    assigneeAgentId,
    assigneeAgentName,
    createdByAgentId,
    createdByAgentName,
    parentId,
    requiresApproval: requiresApproval === true,
    approvalStatus: requiresApproval === true ? 'pendente' : undefined,
    approvalType,
    hireData,
    focusData,
    workflowId,
    logs: [{ ts: new Date().toISOString(), msg: `Tarefa criada${createdByAgentName ? ` pelo ${createdByAgentName}` : ''}.`, ok: true }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const issues = loadIssues(req.userId);
  issues.push(issue);
  saveIssues(req.userId, issues);
  res.json(issue);
});

// PUT /api/issues/:id
issuesRouter.put('/:id', (req: any, res: any) => {
  const issues = loadIssues(req.userId);
  const idx = issues.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Issue não encontrada' });

  const previousStatus = issues[idx].status;

  const updated: Issue = {
    ...issues[idx],
    ...req.body,
    id: issues[idx].id,
    userId: req.userId,
    updatedAt: new Date().toISOString(),
    logs: issues[idx].logs || [],
  };

  if (req.body.status === 'concluido' && !issues[idx].completedAt) {
    updated.completedAt = new Date().toISOString();
  }

  if (req.body.status && req.body.status !== previousStatus) {
    addLog(updated, `Status alterado: ${previousStatus} → ${req.body.status}`);
  }

  issues[idx] = updated;
  saveIssues(req.userId, issues);

  if (req.body.status === 'concluido' && previousStatus !== 'concluido') {
    notifyCEOTaskComplete(req.userId, updated).catch(() => {});
  }

  res.json(updated);
});

// DELETE /api/issues/:id
issuesRouter.delete('/:id', (req: any, res: any) => {
  const issues = loadIssues(req.userId).filter(i => i.id !== req.params.id);
  saveIssues(req.userId, issues);
  res.json({ ok: true });
});

// POST /api/issues/:id/approve
issuesRouter.post('/:id/approve', (req: any, res: any) => {
  const issues = loadIssues(req.userId);
  const idx = issues.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Issue não encontrada' });

  const issue = issues[idx];
  if (!issue.logs) issue.logs = [];

  issue.approvalStatus = 'aprovado';
  issue.approvalNote = req.body.note || '';
  issue.updatedAt = new Date().toISOString();
  addLog(issue, `Aprovado pelo usuário.${req.body.note ? ' Nota: ' + req.body.note : ''}`);

  // Aprovar contratação → criar agente
  if (issue.approvalType === 'contratar' && issue.hireData) {
    try {
      const agentId = createAgentFromHireData(req.userId, issue.hireData);
      issue.status = 'concluido';
      issue.completedAt = new Date().toISOString();
      addLog(issue, `✅ Agente "${issue.hireData.name}" criado com sucesso. ID: ${agentId}`);
    } catch (e: any) {
      addLog(issue, `❌ Erro ao criar agente: ${e.message}`, false);
    }
  }

  // Aprovar mudança de foco → atualizar workspace
  if (issue.approvalType === 'foco' && issue.focusData) {
    updateCompanyFocus(req.userId, issue.focusData);
    issue.status = 'concluido';
    issue.completedAt = new Date().toISOString();
    addLog(issue, '✅ Foco da empresa atualizado no workspace.');
  }

  issues[idx] = issue;
  saveIssues(req.userId, issues);
  res.json(issue);
});

// POST /api/issues/:id/reject
issuesRouter.post('/:id/reject', (req: any, res: any) => {
  const issues = loadIssues(req.userId);
  const idx = issues.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Issue não encontrada' });

  if (!issues[idx].logs) issues[idx].logs = [];
  issues[idx].approvalStatus = 'rejeitado';
  issues[idx].approvalNote = req.body.note || '';
  issues[idx].status = 'cancelado';
  issues[idx].updatedAt = new Date().toISOString();
  addLog(issues[idx], `❌ Rejeitado pelo usuário.${req.body.note ? ' Motivo: ' + req.body.note : ''}`, false);

  saveIssues(req.userId, issues);
  res.json(issues[idx]);
});

// POST /api/issues/:id/pause — pausar/retomar tarefa
issuesRouter.post('/:id/pause', (req: any, res: any) => {
  const issues = loadIssues(req.userId);
  const idx = issues.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Issue não encontrada' });

  const paused = !issues[idx].paused;
  if (!issues[idx].logs) issues[idx].logs = [];
  issues[idx].paused = paused;
  issues[idx].updatedAt = new Date().toISOString();
  addLog(issues[idx], paused ? '⏸ Tarefa pausada pelo usuário.' : '▶️ Tarefa retomada pelo usuário.');

  saveIssues(req.userId, issues);
  res.json(issues[idx]);
});
