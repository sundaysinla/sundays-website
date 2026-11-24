import { randomBytes } from 'node:crypto';
import postgres from 'postgres';
import { closeBasketClients, postgresConnection } from '../lib/suggestions/database.ts';
import { migrateBasket } from '../lib/suggestions/schema.ts';

// Point this at a disposable Postgres server. Each test creates and drops its own database.
const serverUrl = process.env.BASKET_TEST_DATABASE_URL;
export const needsPostgres = serverUrl ? false : 'Set BASKET_TEST_DATABASE_URL to a disposable Postgres server';

export async function freshDatabase(t) {
  const admin = postgres(serverUrl, { max: 1, onnotice: () => undefined });
  const name = 'basket_test_' + randomBytes(6).toString('hex');
  await admin.unsafe(`CREATE DATABASE ${name}`);
  const url = new URL(serverUrl);
  url.pathname = '/' + name;
  t.after(async () => {
    await closeBasketClients();
    await admin.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin.end({ timeout: 5 });
  });
  await migrateBasket(postgresConnection(url.toString()));
  return url.toString();
}
