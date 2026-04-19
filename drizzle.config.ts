import type { Config } from 'drizzle-kit';

export default {
  schema: './packages/db/src/schema/index.ts',
  out: './packages/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgres://localhost:5432/mwcode'
  }
} satisfies Config;
