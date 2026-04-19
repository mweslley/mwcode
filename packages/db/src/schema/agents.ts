import { pgTable, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const agents = pgTable('agents', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  adapter: text('adapter').notNull(),
  model: text('model').notNull(),
  skills: jsonb('skills').$type<string[]>().default([]),
  status: text('status').notNull().default('active'),
  hiredAt: timestamp('hired_at').notNull().defaultNow(),
  firedAt: timestamp('fired_at'),
  fireReason: text('fire_reason'),
  performance: integer('performance').default(0),
  tasksCompleted: integer('tasks_completed').default(0),
  hourlyRate: integer('hourly_rate').default(0),
  metadata: jsonb('metadata').$type<Record<string, unknown>>()
});

export const agentHistory = pgTable('agent_history', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull(),
  action: text('action').notNull(),
  reason: text('reason'),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>()
});

export type AgentRow = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
