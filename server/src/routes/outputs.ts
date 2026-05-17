/**
 * Entregas (outputs) produzidas por agentes ao concluir tarefas.
 * Armazenadas em ~/.mwcode/data/outputs/{userId}.json
 */
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { dataDir, dataPath } from '../lib/data-dir.js';

export const outputsRouter = Router();

export interface AgentOutput {
  id: string;
  userId: string;
  issueId?: string;
  issueTitle?: string;
  agentId?: string;
  agentName?: string;
  squadId?: string;
  type: 'text' | 'url' | 'markdown' | 'code';
  title: string;
  content: string;
  createdAt: string;
}

function outputsFile(userId: string): string {
  return dataPath('outputs', `${userId}.json`);
}

function loadOutputs(userId: string): AgentOutput[] {
  dataDir('outputs');
  const file = outputsFile(userId);
  if (!fs.existsSync(file)) return [];
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return []; }
}

function saveOutputs(userId: string, outputs: AgentOutput[]): void {
  fs.writeFileSync(outputsFile(userId), JSON.stringify(outputs, null, 2));
}

/** Salva um output de agente (chamado internamente pelo agent-loop). */
export function saveAgentOutput(userId: string, output: Omit<AgentOutput, 'id' | 'userId' | 'createdAt'>): AgentOutput {
  const outputs = loadOutputs(userId);
  const entry: AgentOutput = {
    id: crypto.randomUUID(),
    userId,
    createdAt: new Date().toISOString(),
    ...output,
  };
  outputs.unshift(entry); // mais recente primeiro
  // Mantém máximo 200 outputs por usuário
  if (outputs.length > 200) outputs.splice(200);
  saveOutputs(userId, outputs);
  return entry;
}

// GET /api/outputs — lista outputs (filtráveis por squadId ou issueId)
outputsRouter.get('/', (req: any, res: any) => {
  let outputs = loadOutputs(req.userId);
  if (req.query.squadId) outputs = outputs.filter(o => o.squadId === req.query.squadId);
  if (req.query.issueId) outputs = outputs.filter(o => o.issueId === req.query.issueId);
  if (req.query.agentId) outputs = outputs.filter(o => o.agentId === req.query.agentId);
  // Limita retorno a 50
  res.json(outputs.slice(0, 50));
});

// POST /api/outputs — cria output manual (ex: Michel anexa um resultado)
outputsRouter.post('/', (req: any, res: any) => {
  const { issueId, issueTitle, agentId, agentName, squadId, type, title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'title e content obrigatórios' });
  const output = saveAgentOutput(req.userId, {
    issueId, issueTitle, agentId, agentName, squadId,
    type: type || 'text', title, content,
  });
  res.json(output);
});

// DELETE /api/outputs/:id — remove output
outputsRouter.delete('/:id', (req: any, res: any) => {
  const outputs = loadOutputs(req.userId).filter(o => o.id !== req.params.id);
  saveOutputs(req.userId, outputs);
  res.json({ ok: true });
});
