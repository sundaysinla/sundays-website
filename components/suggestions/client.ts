import type { BasketNote } from '@/lib/suggestions/model';
import type { DropRequest, ReviewRequest } from '@/lib/suggestions/requests';

type Command = DropRequest | ReviewRequest | { action: 'sign-in'; key: string } | { action: 'sign-out' };
type BasketResponse = { saved?: true; ok?: true; note?: BasketNote; error?: string };

export class BasketRequestError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function postBasket(command: Command): Promise<BasketResponse> {
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
