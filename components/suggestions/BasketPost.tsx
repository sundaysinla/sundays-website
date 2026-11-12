'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { canShowRecap, statusLabels, type PublicPost, type Vote, type VoteState } from '@/lib/suggestions/model';
import BasketDiscussion from './BasketDiscussion';
import { BasketRequestError, ensureVoteCookie, postBasket } from './client';

const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' });

export default function BasketPost({ post }: { post: PublicPost }) {
  const [ready, setReady] = useState(false);
  const [voteResult, setVoteResult] = useState<VoteState | null>(null);
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const votes = voteResult ?? post.votes;

  useEffect(() => setReady(true), []);
  useEffect(() => setVoteResult(null), [post.votes]);

  async function vote(direction: Exclude<Vote, 0>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setVoting(true);
    setError('');
    try {
      await ensureVoteCookie();
      const response = await postBasket({ action: 'vote', id: post.id, value: votes.vote === direction ? 0 : direction });
      if (!response.votes) throw new Error('Missing vote result');
      setVoteResult(response.votes);
    } catch (error) {
      setError(error instanceof BasketRequestError ? error.message : 'The basket couldn’t confirm your vote. Try again.');
    } finally {
      inFlight.current = false;
      setVoting(false);
    }
  }

  return (
    <article className="basket-post" id={`basket-post-${post.id}`}>
      <div className="basket-votes" role="group" aria-label="Vote on this suggestion">
        <button className="basket-vote" type="button" aria-label="Upvote" aria-pressed={votes.vote === 1}
          disabled={!ready} aria-disabled={voting} onClick={() => void vote(1)}>
          <ArrowUp size={17} strokeWidth={1.8} aria-hidden="true" />
        </button>
        <output aria-label="Vote score">{votes.score}</output>
        <button className="basket-vote" type="button" aria-label="Downvote" aria-pressed={votes.vote === -1}
          disabled={!ready} aria-disabled={voting} onClick={() => void vote(-1)}>
          <ArrowDown size={17} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>
      <div className="basket-post-content">
        <div className="basket-post-meta">
          <time dateTime={new Date(post.createdAt).toISOString()}>{shortDate.format(post.createdAt)}</time>
          {canShowRecap(post.status) && <span className="basket-recap-status">{statusLabels[post.status]}</span>}
        </div>
        <p className="basket-post-note">{post.note}</p>
        {error && <p className="basket-message basket-error" role="alert">{error}</p>}
        <BasketDiscussion id={post.id} preview={post.discussion} ready={ready} />
      </div>
    </article>
  );
}
