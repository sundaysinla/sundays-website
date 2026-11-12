'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from 'react';
import { canShowRecap, OUTCOME_LIMIT, reviewStatuses, statusLabels, SUMMARY_LIMIT, type BasketNote, type ReviewStatus } from '@/lib/suggestions/model';
import { BasketRequestError, postBasket } from './client';

export default function HostReview({ note, statusFilter }: { note: BasketNote; statusFilter?: ReviewStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState(note.status);
  const [publish, setPublish] = useState(note.published);
  const [published, setPublished] = useState(note.published);
  const [ready, setReady] = useState(false);
  const [working, setWorking] = useState(false);
  const [refreshing, refresh] = useTransition();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const recap = useRef<HTMLDetailsElement>(null);
  const version = useRef(note.version);
  const fieldId = useId();
  const busy = !ready || working || refreshing;

  useEffect(() => setReady(true), []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const summary = String(form.get('summary') ?? '').trim();
    const outcome = String(form.get('outcome') ?? '').trim();
    setMessage('');
    if (publish && (!summary || !outcome)) {
      if (recap.current) recap.current.open = true;
      setError('Write a short idea summary and outcome before publishing.');
      return;
    }
    setError('');
    setWorking(true);
    try {
      const response = await postBasket({ action: 'review', id: note.id, version: version.current, status, summary, outcome, publish });
      if (!response.note) throw new Error('The basket didn’t confirm your review. Try again.');
      version.current = response.note.version;
      setPublished(response.note.published);
      setMessage(response.note.published ? 'Recap published.' : 'Review saved.');
      if (statusFilter && statusFilter !== response.note.status) refresh(() => router.refresh());
    } catch (error) {
      setError(error instanceof BasketRequestError ? error.message : 'The basket couldn’t confirm the review. Try saving again.');
    } finally {
      setWorking(false);
    }
  }

  function changeStatus(value: ReviewStatus) {
    setStatus(value);
    if (!canShowRecap(value)) setPublish(false);
  }

  return (
    <form className="basket-review" action="/api/suggestions" method="post" onSubmit={save} aria-busy={busy}>
      <fieldset disabled={busy}>
        <label htmlFor={`${fieldId}-status`}>Status</label>
        <select id={`${fieldId}-status`} value={status} onChange={event => changeStatus(event.target.value as ReviewStatus)}>
          {reviewStatuses.map(value => <option key={value} value={value}>{statusLabels[value]}</option>)}
        </select>
        <details ref={recap} className="basket-review-details">
          <summary>{note.allowRecap ? 'Recap' : 'Outcome'}{published && <span>Published</span>}</summary>
          <div className="basket-review-fields">
            {note.allowRecap && (
              <label>Idea summary
                <textarea name="summary" rows={2} maxLength={SUMMARY_LIMIT} defaultValue={note.summary} />
              </label>
            )}
            <label>{note.allowRecap ? 'What happened' : 'Private outcome'}
              <textarea name="outcome" rows={3} maxLength={OUTCOME_LIMIT} defaultValue={note.outcome} />
            </label>
            {note.allowRecap && (
              <label className="basket-check basket-publish">
                <input type="checkbox" checked={publish} disabled={!canShowRecap(status)}
                  onChange={event => setPublish(event.target.checked)} />
                <span>Publish to From the Basket</span>
              </label>
            )}
            {note.allowRecap && !canShowRecap(status) && <p className="basket-review-hint">Set the status to Tried or Implemented to publish.</p>}
          </div>
        </details>
        {published && !publish && <p className="basket-review-hint">Saving will take down the recap.</p>}
        <button className="basket-button" type="submit">{working || refreshing ? 'Saving…' : 'Save review'}</button>
      </fieldset>
      <p className="basket-message" aria-live="polite">{message}</p>
      {error && <p className="basket-message basket-error" role="alert">{error}</p>}
    </form>
  );
}
