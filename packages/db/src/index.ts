import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

export * from './schema/index.js';

const DATABASE_URL = process.env.DATABASE_URL;

function createDb() {
  if (!DATABASE_URL) {
    console.warn('[db] DATABASE_URL não definida — usando modo memória.');
    return null;
  }
  const client = postgres(DATABASE_URL, { max: 10 });
  return drizzlePg(client, { schema });
}

export const db = createDb();
export { schema };
