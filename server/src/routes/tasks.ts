import { Router } from 'express';
import { memoryStore } from '../store.js';
import { createTask, assignTask, listTasks } from '../services/orchestrator.js';

export const tasksRouter = Router();

tasksRouter.get('/', async (req, res) => {
  const companyId = req.companyId || 'default';
  res.json(await listTasks(companyId));
});

tasksRouter.post('/', async (req, res) => {
  try {
    const companyId = req.companyId || 'default';
    const task = await createTask({
      companyId,
      agentId: req.body.agentId,
      title: req.body.title,
      description: req.body.description,
      priority: req.body.priority
    });
    res.status(201).json(task);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

tasksRouter.get('/:id', (req, res) => {
  const task = memoryStore.tasks.get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Tarefa não encontrada' });
  res.json(task);
});

tasksRouter.put('/:id', async (req, res) => {
  try {
    if (req.body.action === 'execute') {
      const executed = await assignTask(req.params.id);
      return res.json(executed);
    }
    const existing = memoryStore.tasks.get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Tarefa não encontrada' });
    const updated = { ...existing, ...req.body, id: existing.id };
    memoryStore.tasks.set(existing.id, updated);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});
