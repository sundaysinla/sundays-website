'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react';
import { ArrowDown, Check } from 'lucide-react';
import { NOTE_LIMIT } from '@/lib/suggestions/model';
import BasketIllustration from './BasketIllustration';
import { BasketRequestError, postBasket } from './client';

type Delivery = 'still' | 'animated' | null;

export default function BasketComposer() {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [publicPost, setPublicPost] = useState(false);
  const [postedId, setPostedId] = useState<string | null>(null);
  const [refreshing, refresh] = useTransition();
  const [ready, setReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [delivery, setDelivery] = useState<Delivery>(null);
  const [error, setError] = useState('');
  const requestId = useRef<string | null>(null);
  const inFlight = useRef(false);
  const pointerSubmit = useRef(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const receipt = useRef<HTMLHeadingElement>(null);
  const focusDraft = useRef(false);

  useEffect(() => setReady(true), []);

  useEffect(() => {
    if (delivery) receipt.current?.focus();
    else if (focusDraft.current) {
      textarea.current?.focus();
      focusDraft.current = false;
    }
  }, [delivery]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const text = note.trim();
    if (!text) {
      setError('Write a little note first.');
      textarea.current?.focus();
      return;
    }
    const website = String(new FormData(event.currentTarget).get('website') ?? '');
    const animate = pointerSubmit.current;
    pointerSubmit.current = false;
    inFlight.current = true;
    setSending(true);
    setError('');
    try {
      requestId.current ??= crypto.randomUUID();
      const response = await postBasket({ action: 'drop', requestId: requestId.current, note: text, publicPost, website });
      if (!response.saved) throw new Error('The basket didn’t confirm your note. Try again.');
      setPostedId(response.postId ?? null);
      if (response.postId) refresh(() => router.refresh());
      setDelivery(animate ? 'animated' : 'still');
      setNote('');
    } catch (error) {
      if (error instanceof BasketRequestError && error.status >= 400 && error.status < 500) {
        setError(error.message);
      } else {
        // A lost response may hide a committed write. Retry the original text and receipt.
        setUncertain(true);
        setError('The basket couldn’t confirm the save. Try again.');
      }
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }

  function anotherNote() {
    requestId.current = null;
    focusDraft.current = true;
    setPublicPost(false);
    setPostedId(null);
    setUncertain(false);
    setDelivery(null);
  }

  return (
    <section className="basket-hero" aria-labelledby="basket-title">
      <div className="basket-intro">
        <h1 id="basket-title">The Suggestions <em>Basket</em></h1>
        <p>Leave a little note for Sundays.</p>
      </div>
      <BasketIllustration delivery={delivery} />
      <div className="basket-composer">
        {delivery ? (
          <div className="basket-sheet basket-receipt">
            <span className="basket-receipt-mark" aria-hidden="true"><Check size={21} strokeWidth={1.75} /></span>
            <h2 ref={receipt} tabIndex={-1}>In the basket.</h2>
            <p>{postedId ? 'Your note is public.' : 'The Sundays hosts will read your note.'}</p>
            <div className="basket-receipt-actions">
              {postedId && !refreshing && <a className="basket-text-link" href={`/basket#basket-post-${postedId}`}>See your post</a>}
              <button className="basket-text-button" type="button" onClick={anotherNote}>Leave another note</button>
            </div>
          </div>
        ) : (
          <form action="/api/suggestions" method="post" onSubmit={submit} aria-busy={!ready || sending}>
            <fieldset className="basket-fields" disabled={!ready || sending}>
              <div className="basket-sheet basket-note">
                <label htmlFor="basket-note">Your note</label>
                <textarea id="basket-note" ref={textarea} name="note" rows={3} required readOnly={uncertain} maxLength={NOTE_LIMIT} value={note}
                  placeholder="What’s on your mind?" aria-describedby="basket-privacy basket-note-limit"
                  onChange={event => { requestId.current = null; setNote(event.target.value); }} />
                <span id="basket-note-limit" className={note.length > NOTE_LIMIT - 100 ? 'basket-note-count' : 'sr-only'}>
                  {note.length > NOTE_LIMIT - 100 ? `${note.length} / ${NOTE_LIMIT}` : `Up to ${NOTE_LIMIT} characters.`}
                </span>
              </div>

              <div className="basket-trap" aria-hidden="true">
                <label htmlFor="basket-website">Leave this empty</label>
                <input id="basket-website" type="text" name="website" tabIndex={-1} autoComplete="off" />
              </div>

              <p className="basket-privacy" id="basket-privacy">Private by default. Skip personal details.</p>
              <label className="basket-check">
                <input type="checkbox" checked={publicPost} disabled={uncertain}
                  onChange={event => { requestId.current = null; setPublicPost(event.target.checked); }} />
                <span>Post publicly so anyone can see it.</span>
              </label>

              <button className="basket-button basket-drop" type="submit" onClick={event => { pointerSubmit.current = event.detail > 0; }}>
                {sending ? 'Saving your note…' : uncertain ? 'Try again' : 'Drop in the basket'} <ArrowDown size={17} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </fieldset>
            {error && <p className="basket-message basket-error" role="alert">{error}</p>}
            <noscript><p className="basket-message">Enable JavaScript to drop a note.</p></noscript>
          </form>
        )}
      </div>
    </section>
  );
}
