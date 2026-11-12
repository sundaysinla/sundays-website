import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { handleBasket } from '../lib/suggestions/handler.ts';
import { openBasket } from '../lib/suggestions/store.ts';

const host = 'localhost:4010';
const origin = `http://${host}`;
const start = 1_800_000_000_000;

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'sundays-basket-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, 'basket.sqlite');
  const env = {
    NODE_ENV: 'development',
    NEXT_PUBLIC_SUGGESTIONS_BASKET: 'true',
    SUGGESTIONS_BASKET_HOST_KEY: 'basket-test-key-for-a-temporary-database',
    SUGGESTIONS_BASKET_DB_PATH: path,
  };

  function send(payload, options = {}) {
    return handleBasket(new Request(options.url ?? 'http://127.0.0.1:4010/api/suggestions', {
      method: 'POST',
      headers: { host, origin, 'content-type': 'application/json', ...options.headers },
      body: JSON.stringify(payload),
    }), options.env ?? env, options.now ?? start);
  }

  async function signIn() {
    const response = await send({ action: 'sign-in', key: env.SUGGESTIONS_BASKET_HOST_KEY });
    assert.equal(response.status, 200);
    const cookie = response.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    return cookie.split(';')[0];
  }

  return { env, path, send, signIn, store: () => openBasket(path) };
}

function drop(values = {}) {
  return {
    action: 'drop', requestId: randomUUID(), category: 'idea',
    note: 'Could we set up a quiet table during the first work block?',
    allowRecap: false, website: '', ...values,
  };
}

function review(row, values = {}) {
  return {
    action: 'review', id: row.id, version: row.version, status: 'tried',
    summary: 'A quieter spot during the first work block.',
    outcome: 'We set out a focus table and kept it for the next session.',
    publish: true, ...values,
  };
}

test('a committed note survives reopening the database and retries do not duplicate it', async (t) => {
  const { path, send, store } = fixture(t);
  const request = drop({ note: '  Can we have a quiet table?  ' });
  const response = await send(request);
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(await response.json(), { saved: true });
  assert.equal((await send(request)).status, 201);
  assert.equal((await send({ ...request, note: 'A different note' })).status, 409);
  const result = (await store()).inbox();
  assert.equal(result.notes.length, 1);
  assert.equal(result.notes[0].note, 'Can we have a quiet table?');
  assert.equal(result.notes[0].status, 'new');
  assert.equal(statSync(path).mode & 0o777, 0o600);
});

test('the preview rejects hosted, foreign-host, cross-origin and malformed requests before saving', async (t) => {
  const { env, send, store } = fixture(t);
  assert.equal((await send(drop(), { env: { ...env, VERCEL: '1' } })).status, 404);
  assert.equal((await send(drop(), { env: { ...env, NODE_ENV: 'production' } })).status, 404);
  assert.equal((await send(drop(), { url: 'http://example.com/api/suggestions' })).status, 404);
  assert.equal((await send(drop(), { headers: { host: 'sundays.example' } })).status, 404);
  assert.equal((await send(drop(), { headers: { origin: 'https://other.example' } })).status, 403);
  assert.equal((await send(drop(), { headers: { origin: '' } })).status, 403);
  assert.equal((await send(drop(), { headers: { 'content-type': 'text/plain' } })).status, 415);
  for (const bad of [
    { note: '  ' }, { note: '\u200b' }, { note: 'Invalid Unicode \uD800' }, { note: 'x'.repeat(601) }, { category: 'unknown' },
    { website: 'https://spam.example' }, { name: 'Unexpected personal data' },
  ]) {
    assert.equal((await send(drop(bad))).status, 400);
  }
  assert.equal((await send(drop({ note: 'x'.repeat(9000) }))).status, 413);
  assert.deepEqual((await store()).inbox().notes, []);
});

test('publication needs a valid host session, explicit permission, a finished trial, and a written recap', async (t) => {
  const { send, signIn, store } = fixture(t);
  await send(drop({ note: 'Private original. Keep this inside the inbox.' }));
  await send(drop({ category: 'try', note: 'Separate raw text from the public recap.', allowRecap: true }));
  const basket = await store();
  const [privateNote] = basket.inbox({ category: 'idea' }).notes;
  const [allowedNote] = basket.inbox({ category: 'try' }).notes;
  assert.equal((await send(review(allowedNote))).status, 401);
  const headers = { cookie: await signIn() };
  assert.equal((await send(review(privateNote), { headers })).status, 409);
  assert.equal((await send(review(allowedNote, { status: 'considering' }), { headers })).status, 409);
  assert.equal((await send(review(allowedNote, { outcome: '' }), { headers })).status, 409);
  assert.deepEqual(basket.showcase(), []);

  const published = review(allowedNote);
  assert.equal((await send(published, { headers })).status, 200);
  assert.equal((await send(published, { headers })).status, 200, 'same review can be retried');
  assert.equal((await send({ ...published, outcome: 'An older edit' }, { headers })).status, 409);
  const [recap] = basket.showcase();
  assert.deepEqual(Object.keys(recap).sort(), ['id', 'outcome', 'status', 'summary']);
  assert.equal(recap.summary, published.summary);
  assert.equal(recap.outcome, published.outcome);
  const [saved] = basket.inbox({ status: 'tried' }).notes;
  assert.equal((await send(review(saved, { status: 'archived', publish: false }), { headers })).status, 200);
  assert.deepEqual(basket.showcase(), []);
  assert.equal(basket.inbox({ status: 'archived' }).notes.length, 1);
});

test('host cookies are signed, scoped to a key, expire, and can be cleared', async (t) => {
  const { send, signIn, store, env } = fixture(t);
  await send(drop({ allowRecap: true }));
  const [row] = (await store()).inbox().notes;
  const cookie = await signIn();
  assert.equal((await send(review(row), { headers: { cookie: cookie + 'x' } })).status, 401);
  assert.equal((await send(review(row), { headers: { cookie }, now: start + 2 * 60 * 60_000 })).status, 401);
  assert.equal((await send(review(row), {
    headers: { cookie }, env: { ...env, SUGGESTIONS_BASKET_HOST_KEY: randomUUID() },
  })).status, 401);
  assert.match((await send({ action: 'sign-out' }, { headers: { cookie } })).headers.get('set-cookie'), /Max-Age=0/);
});

test('the persistent rate limit counts new notes and expires independently of host login attempts', async (t) => {
  const { env, send, store } = fixture(t);
  const first = drop();
  assert.equal((await send(first)).status, 201);
  for (let i = 1; i < 30; i++) assert.equal((await send(drop())).status, 201);
  assert.equal((await send(first)).status, 201);
  assert.equal((await send(drop())).status, 429);
  assert.equal((await send(drop(), { now: start + 5 * 60_000 })).status, 201);
  assert.equal((await store()).inbox().hasNext, true);
  assert.equal((await store()).inbox({ page: 1 }).notes.length, 15);
  for (let i = 0; i < 8; i++) {
    assert.equal((await send({ action: 'sign-in', key: 'wrong' })).status, 401);
  }
  const login = { action: 'sign-in', key: env.SUGGESTIONS_BASKET_HOST_KEY };
  assert.equal((await send(login)).status, 429);
  assert.equal((await send(login, { now: start + 5 * 60_000 })).status, 200);
});
