import postgres from 'postgres';

type SqlValue = string | number | boolean | null;
type Mode = 'read' | 'write';
export type Query = <Row = Record<string, unknown>>(sql: string, args?: SqlValue[]) => Promise<Row[]>;
export type BasketAccess = <Result>(mode: Mode, operation: (query: Query) => Promise<Result>) => Promise<Result>;
type Tls = false | 'require' | { rejectUnauthorized: true; ca?: string };
export type PostgresConnection = { url: string; ssl: Tls };

const loopback = /^(?:localhost|127\.0\.0\.1|\[::1\])$/i;
const pemCertificate = /^-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----\s*$/;

// Accepts a Supabase connection string, such as the POSTGRES_URL set by the Vercel integration.
// With Supabase's root CA (Project Settings → Database → SSL), the server certificate and hostname
// are verified. A URL asking for sslmode=verify-full or verify-ca is verified against the system CAs.
// Otherwise remote connections are encrypted without verification, which is what sslmode=require means.
export function postgresConnection(value: string | undefined, ca?: string): PostgresConnection | null {
  if (!value?.trim()) return null;
  const certificate = ca?.trim() ? ca.trim().replace(/\\n/g, '\n') : undefined;
  if (certificate !== undefined && !pemCertificate.test(certificate)) return null;
  try {
    const parsed = new URL(value.trim());
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname || !parsed.username ||
      parsed.hash || parsed.pathname.length < 2) return null;
    const mode = parsed.searchParams.get('sslmode');
    // Other parameters, such as Supabase's supa=, are not valid Postgres startup parameters.
    parsed.search = '';
    const verify = certificate !== undefined || mode === 'verify-full' || mode === 'verify-ca';
    const ssl: Tls = verify
      ? { rejectUnauthorized: true, ...(certificate ? { ca: certificate } : {}) }
      : loopback.test(parsed.hostname) ? false : 'require'; // Weaker modes are upgraded for remote hosts.
    return { url: parsed.toString(), ssl };
  } catch {
    return null;
  }
}

// Serverless instances reuse one small pool between requests.
const clients = new Map<string, postgres.Sql>();

export function postgresClient({ url, ssl }: PostgresConnection) {
  const key = url + '\0' + JSON.stringify(ssl);
  let sql = clients.get(key);
  if (!sql) {
    sql = postgres(url, {
      ssl,
      prepare: false, // Supabase's transaction pooler on port 6543 has no prepared statements.
      max: 3,
      idle_timeout: 20,
      connect_timeout: 10,
      onnotice: () => undefined,
      // Timestamps and counts are bigint. They stay well within Number's safe range.
      types: { bigint: { to: 20, from: [20], serialize: (value: number) => String(value), parse: (value: string) => Number(value) } },
    });
    clients.set(key, sql);
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
