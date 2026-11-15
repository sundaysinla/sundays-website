import { basketCookie, VOTER_COOKIE, VOTER_TOKEN_PATTERN, type BasketNote, type DiscussionPage, type HostDiscussionPage, type VoteState } from '@/lib/suggestions/model';
import type { BasketCommand } from '@/lib/suggestions/requests';

type BasketResponse = {
  saved?: true;
  postId?: string;
  ok?: true;
  note?: BasketNote;
  votes?: VoteState;
  discussion?: DiscussionPage;
  hostDiscussion?: HostDiscussionPage;
  hiddenAt?: number | null;
  error?: string;
};

export class BasketRequestError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function postBasket(command: BasketCommand): Promise<BasketResponse> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch('/api/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
      body: JSON.stringify(command),
    });
    const data = await response.json().catch(() => null) as BasketResponse | null;
    if (!response.ok || !data) {
      throw new BasketRequestError(data?.error ?? 'The basket is unavailable. Try again in a moment.', response.status);
    }
    return data;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function ensureVoteCookie() {
  const hasToken = () => VOTER_TOKEN_PATTERN.test(basketCookie(document.cookie, VOTER_COOKIE) ?? '');
  const prepare = () => {
    if (hasToken()) return;
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = VOTER_COOKIE + '=' + crypto.randomUUID() + '; Path=/; SameSite=Strict; Max-Age=31536000' + secure;
    if (!hasToken()) throw new BasketRequestError('Allow cookies in this browser to vote.', 400);
  };

  // Establish the identity before the request, so a lost response can be retried with the same vote.
  if (navigator.locks) await navigator.locks.request(VOTER_COOKIE, prepare);
  else prepare();
}
