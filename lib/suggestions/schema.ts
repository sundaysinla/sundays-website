import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import type { PostgresConnection } from './database.ts';

// The same file can be pasted into Supabase's SQL Editor or applied by the Supabase CLI.
export const migrationFile = new URL('../../supabase/migrations/20261115000000_suggestions_basket.sql', import.meta.url);

export async function migrateBasket(connection: PostgresConnection) {
  const sql = postgres(connection.url, { ssl: connection.ssl, prepare: false, max: 1, onnotice: () => undefined });
  try {
    await sql.unsafe(await readFile(migrationFile, 'utf8'));
  } finally {
    await sql.end({ timeout: 5 });
  }
}
