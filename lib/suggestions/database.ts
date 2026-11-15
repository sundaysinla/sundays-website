import postgres from 'postgres';

type SqlValue = string | number | boolean | null;
type Mode = 'read' | 'write';
export type Query = <Row = Record<string, unknown>>(sql: string, args?: SqlValue[]) => Promise<Row[]>;
export type BasketAccess = <Result>(mode: Mode, operation: (query: Query) => Promise<Result>) => Promise<Result>;
export type PostgresConnection = { url: string; tls: boolean };

const loopback = /^(?:localhost|127\.0\.0\.1|\[::1\])$/i;

// Accepts a Supabase connection string, such as the POSTGRES_URL set by the Vercel integration.
// Query parameters like sslmode and supa are dropped because TLS is configured explicitly below.
export function postgresConnection(value: string | undefined): PostgresConnection | null {
  if (!value?.trim()) return null;
  try {
    const parsed = new URL(value.trim());
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname || !parsed.username ||
      parsed.hash || parsed.pathname.length < 2) return null;
    parsed.search = '';
    return { url: parsed.toString(), tls: !loopback.test(parsed.hostname) };
  } catch {
    return null;
  }
}

// Serverless instances reuse one small pool between requests.
const clients = new Map<string, postgres.Sql>();

export function postgresClient({ url, tls }: PostgresConnection) {
  let sql = clients.get(url);
  if (!sql) {
    sql = postgres(url, {
      ssl: tls ? 'require' : false,
      prepare: false, // Supabase's transaction pooler on port 6543 has no prepared statements.
      max: 3,
      idle_timeout: 20,
      connect_timeout: 10,
      onnotice: () => undefined,
      // Timestamps and counts are bigint. They stay well within Number's safe range.
      types: { bigint: { to: 20, from: [20], serialize: (value: number) => String(value), parse: (value: string) => Number(value) } },
    });
    clients.set(url, sql);
  }
  return sql;
}

export function postgresAccess(connection: PostgresConnection): BasketAccess {
  return async <Result>(mode: Mode, operation: (query: Query) => Promise<Result>) => {
    const options = mode === 'write' ? 'read write' : 'isolation level repeatable read, read only';
    let result!: Result;
    await postgresClient(connection).begin(options, async tx => {
      // One writer at a time keeps idempotent retries, rate limits and vote changes race-free.
      if (mode === 'write') await tx.unsafe("SELECT pg_advisory_xact_lock(hashtext('sundays-basket'))");
      const query: Query = async <Row>(sql: string, args: SqlValue[] = []) =>
        Array.from(await tx.unsafe(sql, args as postgres.ParameterOrJSON<never>[])) as Row[];
      result = await operation(query);
    });
    return result;
  };
}

// Used by scripts and tests so idle pools do not keep Node running.
export async function closeBasketClients() {
  const open = [...clients.values()];
  clients.clear();
  await Promise.all(open.map(sql => sql.end({ timeout: 5 })));
}
