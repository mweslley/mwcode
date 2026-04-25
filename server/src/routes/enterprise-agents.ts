import { Router } from 'express';
import fs from 'fs';
import path from 'path';

const AGENTS_DIR = path.resolve(__dirname, '../../../data/agents');

interface Agent {
  id: string;
  userId: string;
  name: string;
  role: string;
  personality: string;
  goals: string[];
  skills: string[];
  model: string;
  provider: string;
  status: 'active' | 'fired';
  salary?: number;
  hireDate?: string;
  createdAt: string;
}

function getAgentsDir(userId: string): string {
  const dir = path.join(AGENTS_DIR, userId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getAgents(userId: string, status?: string): Agent[] {
  const dir = getAgentsDir(userId);
  if (!fs.existsSync(dir)) return [];
  
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  const agents: Agent[] = [];
  
  for (const file of files) {
    const agent = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
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

export const agentsRouter = Router();

// Get all agents
agentsRouter.get('/', (req, res) => {
  const userId = (req as any).userId;
  const status = req.query.status as string;
  res.json(getAgents(userId, status));
});

// Get single agent
agentsRouter.get('/:id', (req, res) => {
  const userId = (req as any).userId;
  const { id } = req.params;
  const agent = getAgent(userId, id);
  if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });
  res.json(agent);
});

// Hire (create) agent
agentsRouter.post('/hire', (req, res) => {
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
agentsRouter.put('/:id', (req, res) => {
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
agentsRouter.delete('/:id', (req, res) => {
  const userId = (req as any).userId;
  const { id } = req.params;
  
  const agent = getAgent(userId, id);
  if (agent) {
    // Não apaga, marca como fired
    agent.status = 'fired';
    const dir = getAgentsDir(userId);
    fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(agent, null, 2));
  }
  
  res.json({ success: true });
});

// Reactivate agent
agentsRouter.post('/:id/reactivate', (req, res) => {
  const userId = (req as any).userId;
  const { id } = req.params;
  
  const agent = getAgent(userId, id);
  if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });
  
  agent.status = 'active';
  const dir = getAgentsDir(userId);
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(agent, null, 2));
  
  res.json(agent);
});