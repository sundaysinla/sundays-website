import { postgresConnection } from '../lib/suggestions/database.ts';
import { migrateBasket } from '../lib/suggestions/schema.ts';

// Prefer the direct connection for schema changes. The pooled URL also works.
const { SUGGESTIONS_BASKET_DATABASE_URL, POSTGRES_URL_NON_POOLING, POSTGRES_URL, SUGGESTIONS_BASKET_DATABASE_CA } = process.env;
const connection = postgresConnection(SUGGESTIONS_BASKET_DATABASE_URL || POSTGRES_URL_NON_POOLING || POSTGRES_URL, SUGGESTIONS_BASKET_DATABASE_CA);
if (!connection) {
  console.error('Set SUGGESTIONS_BASKET_DATABASE_URL (local) or POSTGRES_URL_NON_POOLING (Supabase) to a postgres:// connection string.');
  process.exitCode = 1;
} else {
  try {
    await migrateBasket(connection);
    console.log(`Basket schema is ready on ${new URL(connection.url).host} (${connection.ssl === false ? 'local, no TLS' : connection.ssl === 'require' ? 'TLS, certificate not verified' : 'TLS, certificate verified'}).`);
  } catch (error) {
    const code = typeof error?.code === 'string' && /^[A-Z0-9_]+$/.test(error.code) ? ` (${error.code})` : '';
    console.error(`Could not prepare the Basket database${code}. Check the connection string, then retry.`);
    process.exitCode = 1;
  }
}
