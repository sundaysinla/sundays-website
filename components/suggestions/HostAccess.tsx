'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition, type FormEvent } from 'react';
import { BasketRequestError, postBasket } from './client';

export default function HostAccess({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [working, setWorking] = useState(false);
  const [refreshing, refresh] = useTransition();
  const [error, setError] = useState('');
  const busy = !ready || working || refreshing;

  useEffect(() => setReady(true), []);

  async function changeAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    setWorking(true);
    setError('');
    try {
      const key = String(new FormData(form).get('key') ?? '');
      await postBasket(signedIn ? { action: 'sign-out' } : { action: 'sign-in', key });
      form.reset();
      refresh(() => router.refresh());
    } catch (error) {
      setError(error instanceof BasketRequestError ? error.message : 'The connection dropped. Try again.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <form className={signedIn ? 'basket-sign-out' : 'basket-sheet basket-sign-in'} action="/api/suggestions" method="post" onSubmit={changeAccess} aria-busy={busy}>
      {signedIn ? (
        <button className="basket-text-button" type="submit" disabled={busy}>{working || refreshing ? 'Signing out…' : 'Sign out'}</button>
      ) : (
        <>
          <label htmlFor="basket-host-key">Host key</label>
          <input type="password" id="basket-host-key" name="key" autoComplete="off" maxLength={256} required readOnly={busy} />
          <button className="basket-button" type="submit" disabled={busy}>{working || refreshing ? 'Signing in…' : 'Sign in'}</button>
          <noscript><p className="basket-message">Enable JavaScript to sign in.</p></noscript>
        </>
      )}
      {error && <p className="basket-message basket-error" role="alert">{error}</p>}
    </form>
  );
}
