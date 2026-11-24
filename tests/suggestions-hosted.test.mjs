import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import { authenticateHost, basketConfig, basketOrigin, basketVisitor, hostSessionCookie, validHostSession, voterHash } from '../lib/suggestions/access.ts';
import { postgresConnection } from '../lib/suggestions/database.ts';
import { handleBasket, handleKeepalive } from '../lib/suggestions/handler.ts';
import { openBasket } from '../lib/suggestions/store.ts';
import { freshDatabase, needsPostgres } from './basket-postgres.mjs';

const host = 'basket-preview-fixture.vercel.app';
const origin = `https://${host}`;
const now = 1_800_000_000_000;
const token = () => randomBytes(32).toString('base64url');
const digest = value => createHash('sha256').update(value).digest('hex');

const supabaseUrl = 'postgres://postgres.abcdefghijklmnop:fixture@aws-0-us-west-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x';

function fixture(databaseUrl = supabaseUrl) {
  const keys = { alex: token(), jo: token() };
  const hosts = { alex: digest(keys.alex), jo: digest(keys.jo) };
  const env = {
    NODE_ENV: 'production', VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_URL: host,
    SUGGESTIONS_BASKET_ENABLED: 'true',
    SUGGESTIONS_BASKET_SESSION_SECRET: token(), SUGGESTIONS_BASKET_HOSTS: JSON.stringify(hosts),
    POSTGRES_URL: databaseUrl,
  };

  function send(payload, { headers, environment = env, time = now } = {}) {
    return handleBasket(new Request('http://localhost/api/suggestions', {
      method: 'POST',
      headers: {
        host, origin, 'x-forwarded-proto': 'https', 'x-vercel-forwarded-for': '192.0.2.10',
        'content-type': 'application/json', ...headers,
      },
      body: JSON.stringify(payload),
    }), environment, time);
  }

  return { env, hosts, keys, send };
}

test('Vercel enables the Basket only with complete configuration and an approved HTTPS host', async () => {
  const { env, send } = fixture();
  for (const patch of [
    { SUGGESTIONS_BASKET_ENABLED: 'false' }, { SUGGESTIONS_BASKET_HOSTS: '{}' },
    { POSTGRES_URL: undefined }, { POSTGRES_URL: 'file:/tmp/basket' }, { POSTGRES_URL: 'https://db.example.supabase.co' },
    { POSTGRES_URL: 'postgres://db.example.supabase.co:5432/postgres' }, { POSTGRES_URL: 'postgres://user:pw@db.example.supabase.co' },
    { VERCEL: undefined }, { VERCEL_ENV: 'development' },
  ]) {
    assert.equal((await send({ action: 'sign-out' }, { environment: { ...env, ...patch } })).status, 404);
  }
  assert.equal((await send({ action: 'sign-out' }, { headers: { host: 'another.vercel.app' } })).status, 404);
  assert.equal((await send({ action: 'sign-out' }, { headers: { origin: 'https://another.vercel.app' } })).status, 403);
  assert.equal((await send({ action: 'sign-out' }, { headers: { 'x-forwarded-proto': 'http' } })).status, 404);
  assert.equal((await send({ action: 'drop', requestId: randomUUID(), note: 'Fixture', publicPost: true, website: '' }, {
    headers: { 'x-vercel-forwarded-for': '', 'x-forwarded-for': '192.0.2.10' },
  })).status, 403);
  assert.equal((await send({ action: 'host-comments', id: randomUUID() })).status, 401);

  const production = basketConfig({ ...env, VERCEL_ENV: 'production', SUGGESTIONS_BASKET_ORIGINS: 'https://www.sundays.rsvp' });
  assert(production);
  const requestHeaders = new Headers({ host: 'www.sundays.rsvp', 'x-forwarded-proto': 'https' });
  assert.equal(basketOrigin(production, requestHeaders), 'https://www.sundays.rsvp');
  requestHeaders.set('host', host);
  assert.equal(basketOrigin(production, requestHeaders), null);
});

test('organizer keys and sessions can be revoked independently and IP buckets use Vercel’s address', () => {
  const { env, hosts, keys } = fixture();
  const config = basketConfig(env);
  assert(config);
  assert.equal(authenticateHost(config, `alex.${keys.alex}`), 'alex');
  assert.equal(authenticateHost(config, `alex.${keys.jo}`), null);
  const alex = hostSessionCookie(config, 'alex', now, true);
  const jo = hostSessionCookie(config, 'jo', now, true);
  assert.match(alex, /^__Host-.*; Path=\/; HttpOnly; SameSite=Strict; Max-Age=7200; Secure$/);
  const rotated = basketConfig({ ...env, SUGGESTIONS_BASKET_HOSTS: JSON.stringify({ ...hosts, alex: digest(token()) }) });
  assert(rotated);
  assert.equal(validHostSession(config, alex, now), true);
  assert.equal(validHostSession(rotated, alex, now), false);
  assert.equal(validHostSession(rotated, jo, now), true);
  assert.equal(validHostSession(config, jo, now + 7_200_000), false);

  const address = new Headers({ 'x-vercel-forwarded-for': '2001:0db8:0000:0000:0000:0000:0000:1' });
  const hash = basketVisitor(config, address);
  assert.match(hash, /^[0-9a-f]{64}$/);
  address.set('x-vercel-forwarded-for', '2001:db8::1');
  address.set('x-forwarded-for', '192.0.2.99');
  assert.equal(basketVisitor(config, address), hash);
  address.set('x-vercel-forwarded-for', '192.0.2.99');
  assert.notEqual(basketVisitor(config, address), hash);
  const bucket = ip => basketVisitor(config, new Headers({ 'x-vercel-forwarded-for': ip }));
  assert.equal(bucket('2001:db8:0:0:ffff:1:2:3'), hash, 'addresses in one /64 share a rate-limit bucket');
  assert.notEqual(bucket('2001:db8:0:1::1'), hash, 'a different /64 gets its own bucket');
  assert.equal(bucket('::ffff:192.0.2.99'), bucket('192.0.2.99'), 'IPv4-mapped addresses count as their IPv4 address');
  assert.equal(bucket('::1'), bucket('0:0:0:0:0:0:0:2'));
  assert.throws(() => bucket('fe80::1%eth0'), /couldn’t verify/);
});

const fixtureCa = '-----BEGIN CERTIFICATE-----\nMIIBfixture\n-----END CERTIFICATE-----';

test('Supabase connection strings use TLS, verify with a CA, and drop parameters the driver should not forward', () => {
  const pooled = 'postgres://postgres.abcdefghijklmnop:fixture@aws-0-us-west-1.pooler.supabase.com:6543/postgres';
  assert.deepEqual(postgresConnection(supabaseUrl), { url: pooled, ssl: 'require' });
  assert.deepEqual(postgresConnection(supabaseUrl, fixtureCa), { url: pooled, ssl: { rejectUnauthorized: true, ca: fixtureCa } });
  assert.deepEqual(postgresConnection(supabaseUrl, fixtureCa.replaceAll('\n', '\\n')).ssl, { rejectUnauthorized: true, ca: fixtureCa },
    'escaped newlines from a one-line env var are restored');
  assert.deepEqual(postgresConnection(pooled + '?sslmode=verify-full').ssl, { rejectUnauthorized: true });
  assert.equal(postgresConnection(pooled + '?sslmode=disable').ssl, 'require', 'remote hosts never drop below require');
  assert.equal(postgresConnection(supabaseUrl, 'not a certificate'), null);
  assert.equal(postgresConnection('postgresql://postgres@127.0.0.1:55432/basket').ssl, false);
  assert.equal(postgresConnection('  '), null);
  const { env } = fixture();
  assert(basketConfig({ ...env, SUGGESTIONS_BASKET_DATABASE_CA: fixtureCa }));
  assert.equal(basketConfig({ ...env, SUGGESTIONS_BASKET_DATABASE_CA: 'garbage' }), null, 'a bad CA disables the Basket instead of skipping verification');
});

function keepalive(env, authorization) {
  return handleKeepalive(new Request('https://www.sundays.rsvp/api/suggestions/keepalive', {
    headers: authorization ? { authorization } : {},
  }), env);
}

test('the daily keepalive needs the Basket, a cron secret and the matching bearer token', async () => {
  const { env } = fixture();
  const secret = token();
  assert.equal((await keepalive(env, `Bearer ${secret}`)).status, 404);
  assert.equal((await keepalive({ ...env, CRON_SECRET: 'short' }, 'Bearer short')).status, 404);
  assert.equal((await keepalive({ ...env, CRON_SECRET: secret }, undefined)).status, 401);
  assert.equal((await keepalive({ ...env, CRON_SECRET: secret }, `Bearer ${token()}`)).status, 401);
});

test('Postgres persists private notes, idempotent writes, moderation, votes and per-IP limits', { skip: needsPostgres }, async (t) => {
  const { env, keys, send } = fixture(await freshDatabase(t));
  const config = basketConfig(env);
  assert(config);
  const basket = openBasket(config.connection);
  const cron = token();
  assert.equal((await keepalive({ ...env, CRON_SECRET: cron }, `Bearer ${cron}`)).status, 200);

  const marker = randomUUID();
  const drop = (note, publicPost) => ({ action: 'drop', requestId: randomUUID(), note, publicPost, website: '' });
  const privateNote = `Private ${marker}`;
  const publicNote = `Public ${marker}`;
  assert.equal((await send(drop(privateNote, false))).status, 201);
  const post = drop(publicNote, true);
  const responses = await Promise.all([send(post), send(post)]);
  assert.deepEqual(responses.map(response => response.status), [201, 201]);
  const [first, second] = await Promise.all(responses.map(response => response.json()));
  assert.deepEqual(first, second);
  const id = first.postId;

  const login = await send({ action: 'sign-in', key: `alex.${keys.alex}` });
  assert.equal(login.status, 200);
  const hostHeaders = { cookie: login.headers.get('set-cookie').split(';')[0] };
  const voter = randomUUID();
  assert.equal((await send({ action: 'vote', id, value: 1 }, { headers: { cookie: `sundays_basket_voter=${voter}` } })).status, 200);

  const comment = { action: 'comment', id, requestId: randomUUID(), body: `Reply ${marker}`, website: '' };
  const replies = await Promise.all([send(comment), send(comment)]);
  assert.deepEqual(replies.map(response => response.status), [201, 201]);
  const { discussion } = await replies[0].json();
  assert.equal(discussion.count, 1);
  const moderate = { action: 'moderate-comment', id, commentId: discussion.comments[0].id, hidden: true };
  assert.equal((await send(moderate)).status, 401);
  assert.equal((await send(moderate, { headers: hostHeaders })).status, 200);
  assert.deepEqual((await (await send(comment)).json()).discussion, { comments: [], count: 0, before: null });

  const reopened = openBasket(config.connection);
  const { posts } = await reopened.publicFeed(voterHash(voter));
  assert.equal(posts.filter(post => post.note === publicNote).length, 1);
  assert.equal(posts.some(post => post.note === privateNote), false);
  assert.deepEqual(posts.find(post => post.id === id).votes, { score: 1, vote: 1 });
  assert.equal(posts.find(post => post.id === id).discussion.count, 0);
  assert((await basket.inbox()).notes.some(note => note.note === privateNote));
  const { hostDiscussion } = await (await send({ action: 'host-comments', id }, { headers: hostHeaders })).json();
  assert.equal(hostDiscussion.comments[0].hiddenAt, now);
  assert.equal((await send({ ...moderate, hidden: false }, { headers: hostHeaders })).status, 200);
  assert.deepEqual((await reopened.comments(id)).comments, discussion.comments);

  for (let i = 0; i < 4; i++) assert.equal((await send(drop(`Rate fixture ${i}`, false))).status, 201);
  assert.equal((await send(drop('This is over the limit.', false))).status, 429);
  assert.equal((await send(post)).status, 201);
  assert.equal((await send(drop('Another visitor can still post.', false), {
    headers: { 'x-vercel-forwarded-for': '192.0.2.20' },
  })).status, 201);
});
