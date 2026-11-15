import { chmodSync, closeSync, mkdirSync, openSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { localSchemaVersion, migrateBasket } from './schema.ts';

type SqlValue = string | number | null;
type Mode = 'read' | 'write';
export type Query = <Row = Record<string, SqlValue>>(sql: string, args?: SqlValue[]) => Promise<Row[]>;
export type BasketAccess = <Result>(mode: Mode, operation: (query: Query) => Promise<Result>) => Promise<Result>;
export type TursoConnection = { url: string; authToken: string };

export function tursoConnection(env: NodeJS.ProcessEnv): TursoConnection | null {
  const { TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: authToken } = env;
  if (!url || !authToken?.trim()) return null;
  try {
    const parsed = new URL(url);
    if (!['libsql:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    return { url, authToken };
  } catch {
    return null;
  }
}

// A synchronous SQLite lock must never wait on another operation in this process.
let localQueue = Promise.resolve();

export function sqliteAccess(filename: string): BasketAccess {
  const path = resolve(filename);
  return (mode, operation) => {
    const result = localQueue.then(async () => {
      const { DatabaseSync } = await import('node:sqlite');
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
      closeSync(openSync(path, 'a', 0o600));
      chmodSync(path, 0o600);
      const db = new DatabaseSync(path);
      const query: Query = async <Row>(sql: string, args: SqlValue[] = []) =>
        db.prepare(sql).all(...args) as Row[];

      try {
        db.exec('PRAGMA busy_timeout = 2500');
        const version = Number(db.prepare('PRAGMA user_version').get()?.user_version);
        if (version < localSchemaVersion) {
          db.exec('BEGIN IMMEDIATE');
          await migrateBasket(query);
          db.exec(`PRAGMA user_version = ${localSchemaVersion}`);
          db.exec('COMMIT');
        }
        db.exec(mode === 'write' ? 'BEGIN IMMEDIATE' : 'BEGIN');
        const data = await operation(query);
        db.exec('COMMIT');
        return data;
      } finally {
        db.close();
      }
    });
    localQueue = result.then(() => undefined, () => undefined);
    return result;
  };
}

export function tursoAccess(connection: TursoConnection): BasketAccess {
  return async (mode, operation) => {
    const { createClient } = await import('@libsql/client/web');
    const client = createClient(connection);
    try {
      const transaction = await client.transaction(mode);
      const query: Query = async <Row>(sql: string, args: SqlValue[] = []) =>
        (await transaction.execute({ sql, args })).rows as Row[];
      try {
        const data = await operation(query);
        await transaction.commit();
        return data;
      } catch (error) {
        await transaction.rollback().catch(() => undefined);
        throw error;
      } finally {
        transaction.close();
      }
    } finally {
      client.close();
    }
  };
}
