'use client';

import { motion } from 'framer-motion';
import { useEffect, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react';
import { MessageCircle } from 'lucide-react';
import { COMMENT_LIMIT, COMMENT_PREVIEW, type DiscussionPage } from '@/lib/suggestions/model';
import { BasketRequestError, postBasket } from './client';

type DiscussionError = { message: string; reading: boolean; before?: number };

export default function BasketDiscussion({ id, preview, ready, children }: {
  id: string; preview: DiscussionPage; ready: boolean; children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const [pointerToggle, setPointerToggle] = useState(false);
  const [loaded, setLoaded] = useState<DiscussionPage | null>(null);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<'read' | 'send' | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [missingComment, setMissingComment] = useState(false);
  const [error, setError] = useState<DiscussionError | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const inFlight = useRef(false);
  const requestId = useRef<string | null>(null);
  const commentList = useRef<HTMLUListElement>(null);
  const toggleButton = useRef<HTMLButtonElement>(null);
  const olderButton = useRef<HTMLButtonElement>(null);
  const commentInput = useRef<HTMLTextAreaElement>(null);
  const discussion = loaded && loaded.count >= preview.count ? loaded : preview;
  const items = expanded ? discussion.comments : discussion.comments.slice(0, COMMENT_PREVIEW);
  const layoutDependency = expanded
    ? ['open', items.length, discussion.before, pending === 'read', error?.message, missingComment].join(':')
    : `preview:${discussion.count}`;
  const panelId = 'basket-discussion-' + id;
  const missingCommentId = panelId + '-required';
  const countLabel = discussion.count === 1 ? '1 comment' : `${discussion.count} comments`;
  const toggleLabel = expanded ? 'Hide comments'
    : discussion.count > COMMENT_PREVIEW ? `View all ${countLabel}`
    : discussion.count > 0 ? countLabel : 'Comment';

  useEffect(() => {
    if (document.activeElement === toggleButton.current) {
      toggleButton.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    }
  }, [expanded]);

  async function load(before?: number) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending('read');
    setError(null);
    try {
      const response = await postBasket({ action: 'comments', id, before });
      if (!response.discussion) throw new Error('Missing discussion');
      if (before !== undefined && response.discussion.before === null && document.activeElement === olderButton.current) {
        commentList.current?.focus({ preventScroll: true });
      }
      setLoaded(before === undefined ? response.discussion : {
        ...response.discussion,
        comments: [...discussion.comments, ...response.discussion.comments],
      });
    } catch (error) {
      setError({ message: error instanceof BasketRequestError ? error.message : 'Comments couldn’t load. Try again.', reading: true, before });
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const body = draft.trim();
    if (!body) {
      setMissingComment(true);
      commentInput.current?.focus();
      return;
    }
    const website = String(new FormData(event.currentTarget).get('website') ?? '');
    inFlight.current = true;
    setPending('send');
    setError(null);
    setAnnouncement('');
    try {
      requestId.current ??= crypto.randomUUID();
      const response = await postBasket({ action: 'comment', id, requestId: requestId.current, body, website });
      if (!response.discussion) throw new Error('Missing saved comment');
      setLoaded(response.discussion);
      setDraft('');
      setUncertain(false);
      setAnnouncement('Comment posted.');
      requestId.current = null;
    } catch (error) {
      if (error instanceof BasketRequestError && error.status >= 400 && error.status < 500) {
        if (error.status === 400) setUncertain(false);
        setError({ message: error.message, reading: false });
      } else {
        setUncertain(true);
        setError({ message: 'The basket couldn’t confirm your comment. Try again.', reading: false });
      }
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }

  function toggle(event: MouseEvent<HTMLButtonElement>) {
    setPointerToggle(event.detail > 0);
    setExpanded(!expanded);
    setMissingComment(false);
    if (!expanded) void load();
  }

  return (
    <motion.div className="basket-discussion" layout="position" layoutDependency={layoutDependency}>
      <div className="basket-post-actions">
        {children}
        <button ref={toggleButton} className="basket-discussion-toggle" type="button" aria-expanded={expanded}
          aria-controls={panelId} aria-label={toggleLabel} title={toggleLabel} disabled={!ready} onClick={toggle}>
          <MessageCircle key={`${expanded}:${pointerToggle}`} className={pointerToggle ? 'basket-bubble-pop' : undefined}
            size={15} strokeWidth={1.7} aria-hidden="true" />
          <span>{discussion.count}</span>
        </button>
      </div>
      <div id={panelId} className={expanded ? 'basket-thread' : undefined} data-pointer-reveal={expanded && pointerToggle ? true : undefined}>
        {items.length > 0 && (
          <ul ref={commentList} tabIndex={expanded ? -1 : undefined}
            className={expanded ? 'basket-comments' : 'basket-comments basket-comments-preview'}
            aria-label={expanded ? 'Comments' : 'Comment preview'}>
            {items.map(comment => <li key={comment.id}><p>{comment.body}</p></li>)}
          </ul>
        )}
        {expanded && (
          <>
            {pending === 'read' && <p className="basket-discussion-status" role="status">Loading comments…</p>}
            {discussion.before !== null && (
              <button ref={olderButton} className="basket-text-button" type="button" aria-disabled={pending !== null}
                onClick={() => void load(discussion.before ?? undefined)}>Show older comments</button>
            )}
            {error && (
              <div className="basket-message basket-error">
                <p role="alert">{error.message}</p>
                {error.reading && (
                  <button className="basket-text-button" type="button" onClick={() => {
                    const focusTarget = error.before === undefined ? toggleButton.current : olderButton.current;
                    focusTarget?.focus();
                    void load(error.before);
                  }}>Try again</button>
                )}
              </div>
            )}
            <form className="basket-comment-form" action="/api/suggestions" method="post" noValidate onSubmit={send} aria-busy={pending === 'send'}>
              <label htmlFor={panelId + '-comment'}>Public comment</label>
              <textarea ref={commentInput} id={panelId + '-comment'} name="body" rows={2} maxLength={COMMENT_LIMIT} required
                readOnly={pending === 'send' || uncertain} value={draft}
                aria-invalid={missingComment || undefined} aria-describedby={missingComment ? missingCommentId : undefined}
                onChange={event => {
                  const text = event.target.value;
                  requestId.current = null;
                  setDraft(text);
                  if (missingComment && text.trim()) setMissingComment(false);
                }} />
              {missingComment && <p id={missingCommentId} className="basket-error" role="alert">Write a comment first.</p>}
              <div className="basket-trap" aria-hidden="true">
                <label htmlFor={panelId + '-website'}>Leave this empty</label>
                <input id={panelId + '-website'} type="text" name="website" tabIndex={-1} autoComplete="off" />
              </div>
              <button className="basket-button basket-comment-button" type="submit" aria-disabled={pending !== null}>
                {pending === 'send' ? 'Posting…' : uncertain ? 'Try again' : 'Post comment'}
              </button>
            </form>
          </>
        )}
        <span className="sr-only" aria-live="polite">{announcement}</span>
      </div>
    </motion.div>
  );
}
