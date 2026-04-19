export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  companyId: string;
  agentId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: Date;
  completedAt?: Date | null;
  metadata?: Record<string, unknown>;
}

export interface CreateTaskInput {
  companyId: string;
  agentId: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
}
