import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const chats = pgTable('chats', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  agentId: text('agent_id').notNull(),
  userId: text('user_id').notNull(),
  messages: jsonb('messages').$type<Array<{
    role: 'user' | 'agent' | 'system';
    content: string;
    timestamp: string;
  }>>().default([]),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

export type ChatRow = typeof chats.$inferSelect;
export type NewChat = typeof chats.$inferInsert;
