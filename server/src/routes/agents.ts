import { Router } from 'express';
import { validateHireAgent } from '@mwcode/shared';
import { hireAgent, listAgents, getAgent } from '../services/agent-hire.js';
import { fireAgent } from '../services/agent-fire.js';
import { createTask, assignTask } from '../services/orchestrator.js';

export const agentsRouter = Router();

agentsRouter.get('/', async (req, res) => {
  const companyId = req.companyId || 'default';
  const agents = await listAgents(companyId);
  res.json(agents);
});

agentsRouter.post('/', async (req, res) => {
  try {
    const data = validateHireAgent({ ...req.body, companyId: req.body.companyId || req.companyId || 'default' });
    const agent = await hireAgent(data);
    res.status(201).json(agent);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

agentsRouter.get('/:id', async (req, res) => {
  const companyId = req.companyId || 'default';
  const agent = await getAgent(req.params.id, companyId);
  if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });
  res.json(agent);
});

agentsRouter.delete('/:id', async (req, res) => {
  try {
    const companyId = req.companyId || 'default';
    const reason = (req.body?.reason as string) || 'Não especificado';
    const result = await fireAgent({ agentId: req.params.id, companyId, reason });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

agentsRouter.post('/:id/tarefa', async (req, res) => {
  try {
    const companyId = req.companyId || 'default';
    const task = await createTask({
      companyId,
      agentId: req.params.id,
      title: req.body.title,
      description: req.body.description,
      priority: req.body.priority
    });
    const executed = await assignTask(task.id);
    res.status(201).json(executed);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});
