import { nanoid } from 'nanoid';
import type { Task, CreateTaskInput } from '@mwcode/shared';
import { memoryStore } from '../store.js';
import { buildAdapter } from './failover-service.js';

export async function createTask(data: CreateTaskInput): Promise<Task> {
  const task: Task = {
    id: `task_${nanoid(10)}`,
    companyId: data.companyId,
    agentId: data.agentId,
    title: data.title,
    description: data.description,
    status: 'pending',
    priority: data.priority ?? 'medium',
    createdAt: new Date(),
    completedAt: null
  };
  memoryStore.tasks.set(task.id, task);
  return task;
}

export async function assignTask(taskId: string): Promise<Task> {
  const task = memoryStore.tasks.get(taskId);
  if (!task) throw new Error('Tarefa não encontrada');

  const agent = memoryStore.agents.get(task.agentId);
  if (!agent || agent.status !== 'active') throw new Error('Agente não disponível');

  memoryStore.tasks.set(taskId, { ...task, status: 'in_progress' });

  try {
    const adapter = buildAdapter({ adapter: agent.adapter, model: agent.model });
    const prompt = `${task.title}\n\n${task.description ?? ''}`.trim();
    await adapter.call(prompt, {
      system: `Você é ${agent.name}, ${agent.role}. Execute a tarefa abaixo.`
    });

    const completed: Task = { ...task, status: 'completed', completedAt: new Date() };
    memoryStore.tasks.set(taskId, completed);

    const updatedAgent = {
      ...agent,
      tasksCompleted: agent.tasksCompleted + 1,
      performance: Math.min(100, agent.performance + 5)
    };
    memoryStore.agents.set(agent.id, updatedAgent);

    return completed;
  } catch (err) {
    const failed: Task = { ...task, status: 'failed' };
    memoryStore.tasks.set(taskId, failed);
    throw err;
  }
}

export async function listTasks(companyId: string): Promise<Task[]> {
  return [...memoryStore.tasks.values()].filter(t => t.companyId === companyId);
}
