import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { tursoConnection, type TursoConnection } from './database.ts';
import { basketCookie, BasketError, VOTER_TOKEN_PATTERN } from './model.ts';

const localCookie = 'sundays_basket_host';
const hostedCookie = '__Host-sundays_basket_host';
const sessionLifetime = 2 * 60 * 60_000;
const organizerId = /^[a-z][a-z0-9-]{0,31}$/;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const digestPattern = /^[a-f0-9]{64}$/;
const hostPattern = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;
const vercelHost = /^[a-z0-9-]+\.vercel\.app$/i;

type LocalBasket = { mode: 'local'; key: string; connection: string };
type HostedBasket = { mode: 'hosted'; hosts: Map<string, string>; secret: string; origins: Set<string>; connection: TursoConnection };
type BasketConfig = LocalBasket | HostedBasket;

function organizerDigests(value: string | undefined) {
  try {
    const parsed: unknown = JSON.parse(value ?? '');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const hosts = new Map<string, string>();
    for (const [id, digest] of Object.entries(parsed)) {
      if (!organizerId.test(id) || typeof digest !== 'string' || !digestPattern.test(digest)) return null;
      hosts.set(id, digest);
    }
    return hosts.size ? hosts : null;
  } catch {
    return null;
  }
}

export function basketConfig(env: NodeJS.ProcessEnv = process.env): BasketConfig | null {
  if (!env.VERCEL) {
    const key = env.SUGGESTIONS_BASKET_HOST_KEY;
    if (env.NODE_ENV !== 'development' || env.NEXT_PUBLIC_SUGGESTIONS_BASKET !== 'true' ||
      !key || key.length < 32 || key.length > 256) return null;
    return { mode: 'local', key, connection: env.SUGGESTIONS_BASKET_DB_PATH ?? '.sundays-basket/basket.sqlite' };
  }

  if (env.VERCEL !== '1' || env.SUGGESTIONS_BASKET_ENABLED !== 'true') return null;
  const connection = tursoConnection(env);
  const hosts = organizerDigests(env.SUGGESTIONS_BASKET_HOSTS);
  const secret = env.SUGGESTIONS_BASKET_SESSION_SECRET;
  if (!connection || !hosts || !secret || !tokenPattern.test(secret)) return null;

  const origins = new Set<string>();
  if (env.VERCEL_ENV === 'preview') {
    for (const host of [env.VERCEL_URL, env.VERCEL_BRANCH_URL]) {
      if (host && vercelHost.test(host)) origins.add(`https://${host.toLowerCase()}`);
    }
  }
  if (env.VERCEL_ENV === 'production') {
    for (const origin of (env.SUGGESTIONS_BASKET_ORIGINS ?? '').split(',').map(value => value.trim())) {
      if (origin.startsWith('https://') && hostPattern.test(origin.slice(8))) origins.add(origin.toLowerCase());
    }
  }

  return origins.size ? { mode: 'hosted', hosts, secret, origins, connection } : null;
}

export function localOrigin(host: string | null, protocol = 'http:'): string | null {
  if (protocol !== 'http:' && protocol !== 'https:') return null;
  if (!host || !/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i.test(host)) return null;
  try {
    return new URL(`${protocol}//${host}`).origin;
  } catch {
    return null;
  }
}

export function basketOrigin(config: BasketConfig, headers: Headers, protocol?: string) {
  const host = headers.get('host');
  if (config.mode === 'local') return localOrigin(host, protocol);
  if (!host || headers.get('x-forwarded-proto') !== 'https') return null;
  const origin = `https://${host.toLowerCase()}`;
  return config.origins.has(origin) ? origin : null;
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function sameSecret(actual: string, expected: string) {
  return timingSafeEqual(Buffer.from(digest(actual), 'hex'), Buffer.from(digest(expected), 'hex'));
}

export function authenticateHost(config: BasketConfig, key: string) {
  if (config.mode === 'local') return sameSecret(key, config.key) ? 'local' : null;
  const [id, token, extra] = key.split('.');
  if (extra !== undefined || !organizerId.test(id) || !token || !tokenPattern.test(token)) return null;
  const expected = config.hosts.get(id);
  return expected && sameSecret(digest(token), expected) ? id : null;
}

function sign(config: BasketConfig, id: string, expires: string) {
  const credential = config.mode === 'local' ? (id === 'local' ? digest(config.key) : undefined) : config.hosts.get(id);
  if (!credential) return null;
  const secret = config.mode === 'local' ? config.key : config.secret;
  return createHmac('sha256', secret).update(`sundays-basket-host\0${id}\0${expires}\0${credential}`).digest('base64url');
}

export function validHostSession(config: BasketConfig, cookies: string, now = Date.now()) {
  const value = basketCookie(cookies, config.mode === 'hosted' ? hostedCookie : localCookie);
  if (!value) return false;
  const [id, expires, signature, extra] = value.split('.');
  if (extra !== undefined || !organizerId.test(id) || !expires || !/^\d{13}$/.test(expires) ||
    Number(expires) <= now || !signature || !tokenPattern.test(signature)) return false;
  const expected = sign(config, id, expires);
  return expected !== null && sameSecret(signature, expected);
}

export function voterHash(token: string | undefined) {
  if (!token || !VOTER_TOKEN_PATTERN.test(token)) return null;
  return digest('sundays-basket-voter\0' + token.toLowerCase());
}

export function hostSessionCookie(config: BasketConfig, id: string | null, now: number, secure: boolean) {
  const name = config.mode === 'hosted' ? hostedCookie : localCookie;
  const expires = String(now + sessionLifetime);
  const signature = id && sign(config, id, expires);
  const value = signature ? `${id}.${expires}.${signature}` : '';
  const maxAge = signature ? sessionLifetime / 1000 : 0;
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

export function basketVisitor(config: BasketConfig, headers: Headers) {
  if (config.mode === 'local') return undefined;
  // Vercel overwrites this header at ingress. Ignore client-supplied forwarding chains.
  const address = headers.get('x-vercel-forwarded-for');
  const version = address ? isIP(address) : 0;
  if (!address || !version) throw new BasketError('The basket couldn’t verify this request. Try again.', 403);
  const normalized = version === 6 ? new URL(`https://[${address}]`).hostname : address;
  return createHmac('sha256', config.secret).update('sundays-basket-visitor\0' + normalized).digest('hex');
}
