import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { dataDir } from '../lib/data-dir.js';

const FIRED_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

interface Agent {
  id: string;
  userId: string;
  name: string;
  role: string;
  title?: string;
  personality: string;
  goals: string[];
  skills: string[];
  model: string;
  provider: string;
  status: 'active' | 'fired';
  salary?: number;
  hireDate?: string;
  firedAt?: string;
  lastUsedModel?: string;
  createdAt: string;
}

function getAgentsDir(userId: string): string {
  return dataDir('agents', userId);
}

function getAgents(userId: string, status?: string): Agent[] {
  const dir = getAgentsDir(userId);
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  const agents: Agent[] = [];
  const now = Date.now();

  for (const file of files) {
    const filePath = path.join(dir, file);
    const agent: Agent = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    // Hard-delete fired agents after 7 days
    if (agent.status === 'fired' && agent.firedAt) {
      if (now - new Date(agent.firedAt).getTime() > FIRED_TTL_MS) {
        fs.unlinkSync(filePath);
        continue;
      }
    }

    if (!status || agent.status === status) {
      agents.push(agent);
    }
  }

  return agents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function getAgent(userId: string, id: string): Agent | null {
  const dir = getAgentsDir(userId);
  const file = path.join(dir, `${id}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

export const enterpriseAgentsRouter = Router();

// Get all agents
enterpriseAgentsRouter.get('/', (req, res) => {
  const userId = (req as any).userId;
  const status = req.query.status as string;
  res.json(getAgents(userId, status));
});

// Get single agent
enterpriseAgentsRouter.get('/:id', (req, res) => {
  const userId = (req as any).userId;
  const { id } = req.params;
  const agent = getAgent(userId, id);
  if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });
  res.json(agent);
});

// Hire (create) agent
enterpriseAgentsRouter.post('/hire', (req, res) => {
  const userId = (req as any).userId;
  const { name, role, personality, goals, skills, model, provider, salary } = req.body;
  
  if (!name || !role) {
    return res.status(400).json({ error: 'name e role são obrigatórios' });
  }
  
  const agent: Agent = {
    id: crypto.randomUUID(),
    userId,
    name,
    role,
    personality: personality || '',
    goals: goals || [],
    skills: skills || [],
    model: model || 'openrouter/auto',
    provider: provider || 'openrouter',
    status: 'active',
    salary,
    hireDate: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };
  
  const dir = getAgentsDir(userId);
  fs.writeFileSync(path.join(dir, `${agent.id}.json`), JSON.stringify(agent, null, 2));
  
  res.json(agent);
});

// Update agent
enterpriseAgentsRouter.put('/:id', (req, res) => {
  const userId = (req as any).userId;
  const { id } = req.params;
  const data = req.body;
  
  const agent = getAgent(userId, id);
  if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });
  
  const updated = { ...agent, ...data };
  const dir = getAgentsDir(userId);
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(updated, null, 2));
  
  res.json(updated);
});

// Fire (delete) agent
enterpriseAgentsRouter.delete('/:id', (req, res) => {
  const userId = (req as any).userId;
  const { id } = req.params;
  
  const agent = getAgent(userId, id);
  if (agent) {
    agent.status = 'fired';
    agent.firedAt = new Date().toISOString();
    const dir = getAgentsDir(userId);
    fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(agent, null, 2));
  }

  res.json({ success: true });
});

// Reactivate agent
enterpriseAgentsRouter.post('/:id/reactivate', (req, res) => {
  const userId = (req as any).userId;
  const { id } = req.params;
  
  const agent = getAgent(userId, id);
  if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });
  
  agent.status = 'active';
  const dir = getAgentsDir(userId);
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(agent, null, 2));
  
  res.json(agent);
});