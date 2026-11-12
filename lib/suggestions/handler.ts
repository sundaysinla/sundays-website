import { basketHostKey, HOST_COOKIE, hostSessionCookie, localOrigin, sameSecret, validHostSession, voterHash } from './access.ts';
import { basketCookie, BasketError, VOTER_COOKIE } from './model.ts';
import { basketRequest } from './requests.ts';
import { openBasket } from './store.ts';

function reply(body: object, status: number) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
}

async function readRequest(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new BasketError('Send the note from the basket page.', 415);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new BasketError('The basket could not read that request.', 400);

  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0;
  let text = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 8192) {
        await reader.cancel();
        throw new BasketError('That note is too long.', 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } catch (error) {
    if (error instanceof BasketError) throw error;
    throw new BasketError('The basket could not read that request.', 400);
  } finally {
    reader.releaseLock();
  }
}

export async function handleBasket(request: Request, env = process.env, now = Date.now()): Promise<Response> {
  const key = basketHostKey(env);
  const { host, protocol } = new URL(request.url);
  const origin = localOrigin(request.headers.get('host'), protocol);
  if (!key || !origin || !localOrigin(host, protocol)) return reply({ error: 'Basket unavailable.' }, 404);
  if (request.headers.get('origin') !== origin) return reply({ error: 'Open the basket directly to continue.' }, 403);

  try {
    const parsed = basketRequest.safeParse(await readRequest(request));
    if (!parsed.success) throw new BasketError('Check your entry and try again.', 400);
    const input = parsed.data;
    if (input.action === 'sign-out') {
      const response = reply({ ok: true }, 200);
      response.headers.set('Set-Cookie', hostSessionCookie(null, now, protocol === 'https:'));
      return response;
    }
    const cookies = request.headers.get('cookie') ?? '';
    if (input.action === 'review' && !validHostSession(basketCookie(cookies, HOST_COOKIE), key, now)) {
      throw new BasketError('Sign in as a host to save this review.', 401);
    }
    const store = await openBasket(env.SUGGESTIONS_BASKET_DB_PATH);
    if (input.action === 'drop') {
      return reply({ saved: true, ...store.drop(input, now) }, 201);
    }
    if (input.action === 'comments') {
      return reply({ discussion: store.comments(input.id, input.before) }, 200);
    }
    if (input.action === 'comment') {
      return reply({ discussion: store.addComment(input, now) }, 201);
    }
    if (input.action === 'vote') {
      const voter = voterHash(basketCookie(cookies, VOTER_COOKIE));
      if (!voter) throw new BasketError('Allow cookies in this browser to vote.', 400);
      return reply({ votes: store.vote(input.id, voter, input.value, now) }, 200);
    }
    if (input.action === 'sign-in') {
      store.signInAttempt(now);
      if (!sameSecret(input.key, key)) throw new BasketError('Check the host key and try again.', 401);
      const response = reply({ ok: true }, 200);
      response.headers.set('Set-Cookie', hostSessionCookie(key, now, protocol === 'https:'));
      return response;
    }
    return reply({ note: store.review(input, now) }, 200);
  } catch (error) {
    if (error instanceof BasketError) return reply({ error: error.message }, error.status);
    return reply({ error: 'The basket couldn’t save that. Try again in a moment.' }, 503);
  }
}
