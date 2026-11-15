import { tursoAccess, tursoConnection } from '../lib/suggestions/database.ts';
import { migrateBasket } from '../lib/suggestions/schema.ts';

const connection = tursoConnection(process.env);
if (!connection) {
  console.error('Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN for the target Basket database.');
  process.exitCode = 1;
} else {
  try {
    await tursoAccess(connection)('write', migrateBasket);
    console.log('Basket schema is ready.');
  } catch (error) {
    const code = typeof error?.code === 'string' && /^[A-Z0-9_]+$/.test(error.code) ? ` (${error.code})` : '';
    console.error(`Could not prepare the Basket database${code}. Check the database URL and token, then retry.`);
    process.exitCode = 1;
  }
}
