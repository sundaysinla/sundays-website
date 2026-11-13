import { authenticateHost, basketConfig, basketOrigin, basketVisitor, hostSessionCookie, localOrigin, validHostSession, voterHash } from './access.ts';
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
  const config = basketConfig(env);
  const { host, protocol } = new URL(request.url);
  const origin = config && basketOrigin(config, request.headers, protocol);
  if (!config || !origin || (config.mode === 'local' && !localOrigin(host, protocol))) {
    return reply({ error: 'Basket unavailable.' }, 404);
  }
  if (request.headers.get('origin') !== origin) return reply({ error: 'Open the basket directly to continue.' }, 403);

  try {
    const parsed = basketRequest.safeParse(await readRequest(request));
    if (!parsed.success) throw new BasketError('Check your entry and try again.', 400);
    const input = parsed.data;
    const secure = origin.startsWith('https:');
    if (input.action === 'sign-out') {
      const response = reply({ ok: true }, 200);
      response.headers.set('Set-Cookie', hostSessionCookie(config, null, now, secure));
      return response;
    }
    const cookies = request.headers.get('cookie') ?? '';
    if ((input.action === 'review' || input.action === 'host-comments' || input.action === 'moderate-comment') &&
      !validHostSession(config, cookies, now)) {
      throw new BasketError('Sign in as a host to continue.', 401);
    }
    const store = openBasket(config.connection);
    switch (input.action) {
      case 'drop':
        return reply({ saved: true, ...await store.drop(input, now, basketVisitor(config, request.headers)) }, 201);
      case 'comments':
        return reply({ discussion: await store.comments(input.id, input.before) }, 200);
      case 'host-comments':
        return reply({ hostDiscussion: await store.hostComments(input.id, input.before) }, 200);
      case 'moderate-comment':
        return reply(await store.moderateComment(input.id, input.commentId, input.hidden, now), 200);
      case 'comment':
        return reply({ discussion: await store.addComment(input, now, basketVisitor(config, request.headers)) }, 201);
      case 'vote': {
        const voter = voterHash(basketCookie(cookies, VOTER_COOKIE));
        if (!voter) throw new BasketError('Allow cookies in this browser to vote.', 400);
        return reply({ votes: await store.vote(input.id, voter, input.value, now, basketVisitor(config, request.headers)) }, 200);
      }
      case 'sign-in': {
        await store.signInAttempt(now, basketVisitor(config, request.headers));
        const id = authenticateHost(config, input.key);
        if (!id) throw new BasketError('Check the host key and try again.', 401);
        const response = reply({ ok: true }, 200);
        response.headers.set('Set-Cookie', hostSessionCookie(config, id, now, secure));
        return response;
      }
      case 'review':
        return reply({ note: await store.review(input, now) }, 200);
    }
  } catch (error) {
    if (error instanceof BasketError) return reply({ error: error.message }, error.status);
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
    console.error('Basket request failed', typeof code === 'string' && /^[A-Z0-9_]+$/.test(code) ? code : 'UNKNOWN');
    return reply({ error: 'The basket is temporarily unavailable. Try again in a moment.' }, 503);
  }
}
