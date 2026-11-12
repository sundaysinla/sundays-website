import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { VOTER_TOKEN_PATTERN } from './model.ts';

export const HOST_COOKIE = 'sundays_basket_host';
const sessionLifetime = 2 * 60 * 60_000;

export function basketHostKey(env: Record<string, string | undefined> = process.env) {
  const key = env.SUGGESTIONS_BASKET_HOST_KEY;
  if (env.NODE_ENV !== 'development' || env.NEXT_PUBLIC_SUGGESTIONS_BASKET !== 'true' || env.VERCEL) return null;
  if (!key || key.length < 32 || key.length > 256) return null;
  return key;
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

export function sameSecret(actual: string, expected: string) {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(actual), digest(expected));
}

function sign(key: string, expires: string) {
  return createHmac('sha256', key).update('sundays-basket-host\0' + expires).digest('base64url');
}

export function validHostSession(value: string | undefined, key: string, now = Date.now()) {
  if (!value || !/^\d{13}\.[A-Za-z0-9_-]{43}$/.test(value)) return false;
  const [expires, signature] = value.split('.');
  return Number(expires) > now && sameSecret(signature, sign(key, expires));
}

export function voterHash(token: string | undefined) {
  if (!token || !VOTER_TOKEN_PATTERN.test(token)) return null;
  return createHash('sha256').update('sundays-basket-voter\0' + token.toLowerCase()).digest('hex');
}

export function hostSessionCookie(key: string | null, now: number, secure: boolean) {
  const expires = String(now + sessionLifetime);
  const value = key ? `${expires}.${sign(key, expires)}` : '';
  const maxAge = key ? sessionLifetime / 1000 : 0;
  return `${HOST_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}
