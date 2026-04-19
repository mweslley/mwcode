import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core';

export const companies = pgTable('companies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  plan: text('plan').notNull().default('free'),
  budget: integer('budget').default(0),
  spent: integer('spent').default(0),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

export type CompanyRow = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
