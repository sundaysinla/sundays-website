'use client';

import { useState } from 'react';
import type { HostDiscussionPage } from '@/lib/suggestions/model';
import { BasketRequestError, postBasket } from './client';

export default function HostDiscussion({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<HostDiscussionPage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const panel = `host-comments-${id}`;

  async function load(before?: number) {
    setBusy(true);
    setError('');
    try {
      const { hostDiscussion } = await postBasket({ action: 'host-comments', id, before });
      if (!hostDiscussion) throw new Error('Missing discussion');
      setPage(previous => before && previous ? {
        ...hostDiscussion,
        comments: [...previous.comments, ...hostDiscussion.comments],
      } : hostDiscussion);
    } catch (error) {
      setError(error instanceof BasketRequestError ? error.message : 'Comments couldn’t load. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function moderate(commentId: number, hidden: boolean) {
    setBusy(true);
    setError('');
    try {
      const { hiddenAt } = await postBasket({ action: 'moderate-comment', id, commentId, hidden });
      if (hiddenAt === undefined) throw new Error('Missing moderation state');
      setPage(previous => previous && ({
        ...previous,
        comments: previous.comments.map(comment => comment.id === commentId ? { ...comment, hiddenAt } : comment),
      }));
    } catch (error) {
      setError(error instanceof BasketRequestError ? error.message : 'The change couldn’t be confirmed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="basket-host-discussion">
      <button type="button" className="basket-text-button" aria-expanded={open} aria-controls={panel} disabled={busy}
        onClick={() => {
          setOpen(!open);
          if (!open) void load();
        }}>
        {open ? 'Close comments' : 'Moderate comments'}
      </button>
      <div id={panel} hidden={!open} aria-busy={busy}>
        {!page && busy && <p role="status">Loading comments…</p>}
        {page && (page.comments.length === 0 ? <p>No comments yet.</p> : (
          <ul>
            {page.comments.map(comment => (
              <li key={comment.id}>
                <p>{comment.body}</p>
                <div className="basket-host-comment-actions">
                  <span aria-live="polite">{comment.hiddenAt === null ? 'Visible' : 'Hidden'}</span>
                  <button type="button" className="basket-text-button" disabled={busy}
                    onClick={() => void moderate(comment.id, comment.hiddenAt === null)}>
                    {comment.hiddenAt === null ? 'Hide comment' : 'Restore comment'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ))}
        {page?.before != null && (
          <button type="button" className="basket-text-button" disabled={busy} onClick={() => void load(page.before ?? undefined)}>
            Older comments
          </button>
        )}
        {error && <p className="basket-message basket-error" role="alert">{error}</p>}
      </div>
    </div>
  );
}
