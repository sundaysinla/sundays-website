import { randomUUID } from 'node:crypto';
import { postgresAccess, type BasketAccess, type PostgresConnection, type Query } from './database.ts';
import { BasketError, canShowRecap, COMMENT_PREVIEW, type BasketComment, type BasketNote, type DiscussionPage, type HostDiscussionPage, type PublicPost, type Recap, type ReviewStatus, type Vote, type VoteState } from './model.ts';
import type { CommentRequest, DropRequest, ReviewRequest } from './requests.ts';

const pageSize = 16;
const commentPageSize = 10;
const rateWindow = 5 * 60_000;
const localLimits = { drop: 30, 'sign-in': 8, comment: 60, vote: 240 };
const hostedLimits = { drop: 6, 'sign-in': 8, comment: 15, vote: 90 };
const visiblePost = "post_public AND status <> 'archived'";
const noteFields = `id, note, allow_recap AS "allowRecap", post_public AS "publicPost", created_at AS "createdAt", status,
  summary, outcome, published_at IS NOT NULL AS published, version`;

type PublicPostRow = Omit<PublicPost, 'votes' | 'discussion'> & VoteState & { count: number; preview: BasketComment[] };
type Filters = { status?: ReviewStatus; page?: number };
type RateAction = keyof typeof localLimits;

async function takeSlot(query: Query, action: RateAction, now: number, visitor: string | undefined) {
  const scope = visitor ? `${action}:${visitor}` : action;
  const limit = visitor ? hostedLimits[action] : localLimits[action];
  const cutoff = now - rateWindow;
  const [slot] = await query(`INSERT INTO basket.suggestion_limits AS l (scope, started_at, count) VALUES ($1, $2, 1)
    ON CONFLICT (scope) DO UPDATE SET
      started_at = CASE WHEN l.started_at <= $3 THEN excluded.started_at ELSE l.started_at END,
      count = CASE WHEN l.started_at <= $3 THEN 1 ELSE l.count + 1 END
    WHERE l.started_at <= $3 OR l.count < $4
    RETURNING l.count`, [scope, now, cutoff, limit]);
  if (!slot) throw new BasketError('Too many attempts. Try again in a few minutes.', 429);
  if (visitor) await query('DELETE FROM basket.suggestion_limits WHERE started_at <= $1', [cutoff]);
}

async function requirePublicPost(query: Query, id: string, forHost = false) {
  const condition = forHost ? 'post_public' : visiblePost;
  const [post] = await query(`SELECT 1 FROM basket.suggestions WHERE id = $1 AND ${condition}`, [id]);
  if (!post) throw new BasketError('This discussion is unavailable.', 404);
}

async function readDiscussion(query: Query, id: string, before?: number, forHost = false): Promise<HostDiscussionPage> {
  const visibility = forHost ? '' : 'AND hidden_at IS NULL';
  const [total] = await query<{ count: number }>(`SELECT COUNT(*) AS count FROM basket.suggestion_comments
    WHERE suggestion_id = $1 ${visibility}`, [id]);
  const rows = await query<HostDiscussionPage['comments'][number]>(`SELECT id, body, created_at AS "createdAt", hidden_at AS "hiddenAt"
    FROM basket.suggestion_comments WHERE suggestion_id = $1 ${visibility} AND ($2::bigint IS NULL OR id < $2::bigint)
    ORDER BY id DESC LIMIT $3`, [id, before ?? null, commentPageSize + 1]);
  const comments = rows.slice(0, commentPageSize).map(({ id, body, createdAt, hiddenAt }) => ({ id, body, createdAt, hiddenAt }));
  return { comments, count: total.count, before: rows.length > commentPageSize ? comments[commentPageSize - 1].id : null };
}

function publicDiscussion(discussion: HostDiscussionPage): DiscussionPage {
  return { ...discussion, comments: discussion.comments.map(({ id, body, createdAt }) => ({ id, body, createdAt })) };
}

class BasketStore {
  private readonly access: BasketAccess;

  constructor(access: BasketAccess) {
    this.access = access;
  }

  drop({ requestId, category = 'idea', note, allowRecap, publicPost }: DropRequest, now: number, visitor?: string) {
    const recapConsent = allowRecap === true;
    const publicConsent = publicPost === true;
    return this.access('write', async query => {
      const [previous] = await query('SELECT id, note, category, allow_recap, post_public, status FROM basket.suggestions WHERE request_id = $1', [requestId]);
      if (previous) {
        if (previous.note !== note || previous.category !== category || previous.allow_recap !== recapConsent || previous.post_public !== publicConsent) {
          throw new BasketError('This note changed. Try sending it again.', 409);
        }
        return publicPost && previous.status !== 'archived' ? { postId: String(previous.id) } : {};
      }
      await takeSlot(query, 'drop', now, visitor);
      const id = randomUUID();
      await query(`INSERT INTO basket.suggestions (id, request_id, note, category, allow_recap, post_public, created_at)
        VALUES ($1, $2, $3, $4, $5::boolean, $6::boolean, $7)`, [id, requestId, note, category, recapConsent, publicConsent, now]);
      return publicPost ? { postId: id } : {};
    });
  }

  publicFeed(voter: string | null, page = 0) {
    return this.access('read', async query => {
      const rows = await query<PublicPostRow>(`SELECT s.id, s.note, s.created_at AS "createdAt", s.status,
        COALESCE((SELECT SUM(v.value) FROM basket.suggestion_votes v WHERE v.suggestion_id = s.id), 0) AS score,
        COALESCE((SELECT v.value FROM basket.suggestion_votes v WHERE v.suggestion_id = s.id AND v.voter_hash = $1::text), 0) AS vote,
        (SELECT COUNT(*) FROM basket.suggestion_comments c WHERE c.suggestion_id = s.id AND c.hidden_at IS NULL) AS count,
        (SELECT COALESCE(json_agg(json_build_object('id', p.id, 'body', p.body, 'createdAt', p.created_at) ORDER BY p.id DESC), '[]'::json)
          FROM (SELECT c.id, c.body, c.created_at FROM basket.suggestion_comments c WHERE c.suggestion_id = s.id
            AND c.hidden_at IS NULL ORDER BY c.id DESC LIMIT $2) p) AS preview
        FROM basket.suggestions s WHERE ${visiblePost} ORDER BY s.created_at DESC, s.id DESC LIMIT $3 OFFSET $4`,
        [voter, COMMENT_PREVIEW, pageSize + 1, page * pageSize]);
      const posts: PublicPost[] = rows.slice(0, pageSize).map(({ score, vote, count, preview, ...post }) => {
        const comments: BasketComment[] = preview.map(({ id, body, createdAt }) => ({ id, body, createdAt }));
        const before = count > COMMENT_PREVIEW ? comments[COMMENT_PREVIEW - 1].id : null;
        return { ...post, votes: { score, vote }, discussion: { comments, count, before } };
      });
      return { posts, hasNext: rows.length > pageSize };
    });
  }

  comments(id: string, before?: number) {
    return this.access('read', async query => {
      await requirePublicPost(query, id);
      return publicDiscussion(await readDiscussion(query, id, before));
    });
  }

  hostComments(id: string, before?: number) {
    return this.access('read', async query => {
      await requirePublicPost(query, id, true);
      return readDiscussion(query, id, before, true);
    });
  }

  moderateComment(id: string, commentId: number, hidden: boolean, now: number) {
    return this.access('write', async query => {
      await requirePublicPost(query, id, true);
      const [comment] = await query<{ hiddenAt: number | null }>(`UPDATE basket.suggestion_comments
        SET hidden_at = CASE WHEN $1::boolean THEN COALESCE(hidden_at, $2::bigint) ELSE NULL END
        WHERE id = $3::bigint AND suggestion_id = $4 RETURNING hidden_at AS "hiddenAt"`, [hidden, now, commentId, id]);
      if (!comment) throw new BasketError('This comment is unavailable.', 404);
      return { hiddenAt: comment.hiddenAt };
    });
  }

  addComment({ id, requestId, body }: CommentRequest, now: number, visitor?: string) {
    return this.access('write', async query => {
      await requirePublicPost(query, id);
      const [previous] = await query('SELECT suggestion_id, body FROM basket.suggestion_comments WHERE request_id = $1', [requestId]);
      if (previous && (previous.suggestion_id !== id || previous.body !== body)) {
        throw new BasketError('This comment changed. Try sending it again.', 409);
      }
      if (!previous) {
        await takeSlot(query, 'comment', now, visitor);
        await query('INSERT INTO basket.suggestion_comments (suggestion_id, request_id, body, created_at) VALUES ($1, $2, $3, $4)',
          [id, requestId, body, now]);
      }
      return publicDiscussion(await readDiscussion(query, id));
    });
  }

  vote(id: string, voter: string, value: Vote, now: number, visitor?: string) {
    return this.access('write', async query => {
      await requirePublicPost(query, id);
      const [previous] = await query('SELECT value FROM basket.suggestion_votes WHERE suggestion_id = $1 AND voter_hash = $2', [id, voter]);
      if ((previous?.value ?? 0) !== value) {
        await takeSlot(query, 'vote', now, visitor);
        if (value === 0) {
          await query('DELETE FROM basket.suggestion_votes WHERE suggestion_id = $1 AND voter_hash = $2', [id, voter]);
        } else {
          await query(`INSERT INTO basket.suggestion_votes (suggestion_id, voter_hash, value) VALUES ($1, $2, $3)
            ON CONFLICT (suggestion_id, voter_hash) DO UPDATE SET value = excluded.value`, [id, voter, value]);
        }
      }
      const [total] = await query<{ score: number }>('SELECT COALESCE(SUM(value), 0) AS score FROM basket.suggestion_votes WHERE suggestion_id = $1', [id]);
      return { score: total.score, vote: value };
    });
  }

  signInAttempt(now: number, visitor?: string) {
    return this.access('write', query => takeSlot(query, 'sign-in', now, visitor));
  }

  inbox({ status, page = 0 }: Filters = {}) {
    return this.access('read', async query => {
      const rows = await query<BasketNote>(`SELECT ${noteFields} FROM basket.suggestions
        WHERE ($1::text IS NULL OR status = $1::text)
        ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3`, [status ?? null, pageSize + 1, page * pageSize]);
      return { notes: rows.slice(0, pageSize), hasNext: rows.length > pageSize };
    });
  }

  review(input: ReviewRequest, now: number) {
    return this.access('write', async query => {
      const { id, version, status, summary, outcome, publish } = input;
      const [current] = await query<BasketNote>(`SELECT ${noteFields} FROM basket.suggestions WHERE id = $1`, [id]);
      if (!current) throw new BasketError('This note is no longer in the basket.', 404);
      if (publish && (!current.allowRecap || !canShowRecap(status) || !summary || !outcome)) {
        throw new BasketError('A public recap needs permission, a Tried or Implemented status, and both recap fields.', 409);
      }
      if (current.status === status && current.summary === summary && current.outcome === outcome && current.published === publish) {
        return current;
      }
      if (current.version !== version) throw new BasketError('This note changed in another review. Reload the inbox to see it.', 409);

      const [row] = await query<BasketNote>(`UPDATE basket.suggestions SET status = $1, summary = $2, outcome = $3,
        published_at = CASE WHEN $4::boolean THEN COALESCE(published_at, $5::bigint) ELSE NULL END,
        version = version + 1 WHERE id = $6 RETURNING ${noteFields}`, [status, summary, outcome, publish, now, id]);
      return row;
    });
  }

  // A tiny read that counts as database activity, so a free Supabase project is not paused between sessions.
  ping() {
    return this.access('read', async query => {
      await query('SELECT 1 FROM basket.suggestions LIMIT 1');
    });
  }

  showcase() {
    return this.access('read', async query => {
      const rows = await query<Recap>(`SELECT id, summary, outcome, status FROM basket.suggestions
        WHERE published_at IS NOT NULL AND allow_recap AND NOT post_public AND status IN ('tried', 'implemented')
        ORDER BY published_at DESC, id DESC`);
      return rows.map(row => ({ ...row }));
    });
  }
}

export function openBasket(connection: PostgresConnection) {
  return new BasketStore(postgresAccess(connection));
}
