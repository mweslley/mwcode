import { Router } from 'express';
import fs from 'fs';
import crypto from 'crypto';
import { dataPath, dataDir } from '../lib/data-dir.js';
import { notifyCEOTaskComplete } from '../services/agent-loop.js';

export const issuesRouter = Router();

export type IssueStatus = 'backlog' | 'todo' | 'em_progresso' | 'em_revisao' | 'concluido' | 'cancelado';
export type IssuePriority = 'critico' | 'alto' | 'medio' | 'baixo';

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
  workflowId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

function issuesFile(userId: string): string {
  dataDir('issues'); // garante que a pasta existe
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

// POST /api/issues
issuesRouter.post('/', (req: any, res: any) => {
  const { title, description, status, priority, assigneeAgentId, assigneeAgentName,
          createdByAgentId, createdByAgentName, parentId, requiresApproval, workflowId } = req.body;
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
    workflowId,
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
  };

  if (req.body.status === 'concluido' && !issues[idx].completedAt) {
    updated.completedAt = new Date().toISOString();
  }

  issues[idx] = updated;
  saveIssues(req.userId, issues);

  // Notifica CEO quando tarefa é concluída (fire-and-forget)
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
  issues[idx].approvalStatus = 'aprovado';
  issues[idx].approvalNote = req.body.note || '';
  issues[idx].updatedAt = new Date().toISOString();
  saveIssues(req.userId, issues);
  res.json(issues[idx]);
});

// POST /api/issues/:id/reject
issuesRouter.post('/:id/reject', (req: any, res: any) => {
  const issues = loadIssues(req.userId);
  const idx = issues.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Issue não encontrada' });
  issues[idx].approvalStatus = 'rejeitado';
  issues[idx].approvalNote = req.body.note || '';
  issues[idx].status = 'cancelado';
  issues[idx].updatedAt = new Date().toISOString();
  saveIssues(req.userId, issues);
  res.json(issues[idx]);
});

// GET /api/issues/count/inbox — só o número de pendentes (para badge)
issuesRouter.get('/count/inbox', (req: any, res: any) => {
  const count = loadIssues(req.userId).filter(
    i => i.requiresApproval && i.approvalStatus === 'pendente'
  ).length;
  res.json({ count });
});
