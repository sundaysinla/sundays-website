import { randomUUID } from 'node:crypto';
import { sqliteAccess, tursoAccess, type BasketAccess, type Query, type TursoConnection } from './database.ts';
import { BasketError, canShowRecap, COMMENT_PREVIEW, type BasketComment, type BasketNote, type DiscussionPage, type HostDiscussionPage, type PublicPost, type Recap, type ReviewStatus, type Vote, type VoteState } from './model.ts';
import type { CommentRequest, DropRequest, ReviewRequest } from './requests.ts';

const pageSize = 16;
const commentPageSize = 10;
const rateWindow = 5 * 60_000;
const localLimits = { drop: 30, 'sign-in': 8, comment: 60, vote: 240 };
const hostedLimits = { drop: 6, 'sign-in': 8, comment: 15, vote: 90 };
const visiblePost = "post_public = 1 AND status <> 'archived'";
const noteFields = `id, note, allow_recap AS allowRecap, post_public AS publicPost, created_at AS createdAt, status,
  summary, outcome, published_at IS NOT NULL AS published, version`;

type NoteRow = Omit<BasketNote, 'allowRecap' | 'publicPost' | 'published'> & {
  allowRecap: 0 | 1;
  publicPost: 0 | 1;
  published: 0 | 1;
};
type PublicPostRow = Omit<PublicPost, 'votes' | 'discussion'> & VoteState & { count: number; preview: string };
type Filters = { status?: ReviewStatus; page?: number };
type RateAction = keyof typeof localLimits;

function toNote(row: NoteRow): BasketNote {
  return { ...row, allowRecap: row.allowRecap === 1, publicPost: row.publicPost === 1, published: row.published === 1 };
}

async function takeSlot(query: Query, action: RateAction, now: number, visitor: string | undefined) {
  const scope = visitor ? `${action}:${visitor}` : action;
  const limit = visitor ? hostedLimits[action] : localLimits[action];
  const cutoff = now - rateWindow;
  const [slot] = await query(`INSERT INTO suggestion_limits (scope, started_at, count) VALUES (?, ?, 1)
    ON CONFLICT(scope) DO UPDATE SET
      started_at = CASE WHEN started_at <= ? THEN excluded.started_at ELSE started_at END,
      count = CASE WHEN started_at <= ? THEN 1 ELSE count + 1 END
    WHERE started_at <= ? OR count < ?
    RETURNING count`, [scope, now, cutoff, cutoff, cutoff, limit]);
  if (!slot) throw new BasketError('Too many attempts. Try again in a few minutes.', 429);
  if (visitor) await query('DELETE FROM suggestion_limits WHERE started_at <= ?', [cutoff]);
}

async function requirePublicPost(query: Query, id: string, forHost = false) {
  const condition = forHost ? 'post_public = 1' : visiblePost;
  const [post] = await query(`SELECT 1 FROM suggestions WHERE id = ? AND ${condition}`, [id]);
  if (!post) throw new BasketError('This discussion is unavailable.', 404);
}

async function readDiscussion(query: Query, id: string, before?: number, forHost = false): Promise<HostDiscussionPage> {
  const visibility = forHost ? '' : 'AND hidden_at IS NULL';
  const [total] = await query<{ count: number }>(`SELECT COUNT(*) AS count FROM suggestion_comments
    WHERE suggestion_id = ? ${visibility}`, [id]);
  const rows = await query<HostDiscussionPage['comments'][number]>(`SELECT id, body, created_at AS createdAt, hidden_at AS hiddenAt
    FROM suggestion_comments WHERE suggestion_id = ? ${visibility} AND (? IS NULL OR id < ?) ORDER BY id DESC LIMIT ?`,
    [id, before ?? null, before ?? null, commentPageSize + 1]);
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
    const recapConsent = Number(allowRecap === true);
    const publicConsent = Number(publicPost === true);
    return this.access('write', async query => {
      const [previous] = await query('SELECT id, note, category, allow_recap, post_public, status FROM suggestions WHERE request_id = ?', [requestId]);
      if (previous) {
        if (previous.note !== note || previous.category !== category || previous.allow_recap !== recapConsent || previous.post_public !== publicConsent) {
          throw new BasketError('This note changed. Try sending it again.', 409);
        }
        return publicPost && previous.status !== 'archived' ? { postId: String(previous.id) } : {};
      }
      await takeSlot(query, 'drop', now, visitor);
      const id = randomUUID();
      await query(`INSERT INTO suggestions (id, request_id, note, category, allow_recap, post_public, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`, [id, requestId, note, category, recapConsent, publicConsent, now]);
      return publicPost ? { postId: id } : {};
    });
  }

  publicFeed(voter: string | null, page = 0) {
    return this.access('read', async query => {
      const rows = await query<PublicPostRow>(`SELECT id, note, created_at AS createdAt, status,
        COALESCE((SELECT SUM(value) FROM suggestion_votes WHERE suggestion_id = suggestions.id), 0) AS score,
        COALESCE((SELECT value FROM suggestion_votes WHERE suggestion_id = suggestions.id AND voter_hash = ?), 0) AS vote,
        (SELECT COUNT(*) FROM suggestion_comments WHERE suggestion_id = suggestions.id AND hidden_at IS NULL) AS count,
        (SELECT json_group_array(json_object('id', id, 'body', body, 'createdAt', created_at))
          FROM (SELECT id, body, created_at FROM suggestion_comments WHERE suggestion_id = suggestions.id
            AND hidden_at IS NULL ORDER BY id DESC LIMIT ?)) AS preview
        FROM suggestions WHERE ${visiblePost} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
        [voter, COMMENT_PREVIEW, pageSize + 1, page * pageSize]);
      const posts: PublicPost[] = rows.slice(0, pageSize).map(({ score, vote, count, preview, ...post }) => {
        const comments: BasketComment[] = JSON.parse(preview);
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
      const [comment] = await query<{ hiddenAt: number | null }>(`UPDATE suggestion_comments
        SET hidden_at = CASE WHEN ? THEN COALESCE(hidden_at, ?) ELSE NULL END
        WHERE id = ? AND suggestion_id = ? RETURNING hidden_at AS hiddenAt`, [Number(hidden), now, commentId, id]);
      if (!comment) throw new BasketError('This comment is unavailable.', 404);
      return { hiddenAt: comment.hiddenAt };
    });
  }

  addComment({ id, requestId, body }: CommentRequest, now: number, visitor?: string) {
    return this.access('write', async query => {
      await requirePublicPost(query, id);
      const [previous] = await query('SELECT suggestion_id, body FROM suggestion_comments WHERE request_id = ?', [requestId]);
      if (previous && (previous.suggestion_id !== id || previous.body !== body)) {
        throw new BasketError('This comment changed. Try sending it again.', 409);
      }
      if (!previous) {
        await takeSlot(query, 'comment', now, visitor);
        await query('INSERT INTO suggestion_comments (suggestion_id, request_id, body, created_at) VALUES (?, ?, ?, ?)',
          [id, requestId, body, now]);
      }
      return publicDiscussion(await readDiscussion(query, id));
    });
  }

  vote(id: string, voter: string, value: Vote, now: number, visitor?: string) {
    return this.access('write', async query => {
      await requirePublicPost(query, id);
      const [previous] = await query('SELECT value FROM suggestion_votes WHERE suggestion_id = ? AND voter_hash = ?', [id, voter]);
      if ((previous?.value ?? 0) !== value) {
        await takeSlot(query, 'vote', now, visitor);
        if (value === 0) {
          await query('DELETE FROM suggestion_votes WHERE suggestion_id = ? AND voter_hash = ?', [id, voter]);
        } else {
          await query(`INSERT INTO suggestion_votes (suggestion_id, voter_hash, value) VALUES (?, ?, ?)
            ON CONFLICT(suggestion_id, voter_hash) DO UPDATE SET value = excluded.value`, [id, voter, value]);
        }
      }
      const [total] = await query<{ score: number }>('SELECT COALESCE(SUM(value), 0) AS score FROM suggestion_votes WHERE suggestion_id = ?', [id]);
      return { score: total.score, vote: value };
    });
  }

  signInAttempt(now: number, visitor?: string) {
    return this.access('write', query => takeSlot(query, 'sign-in', now, visitor));
  }

  inbox({ status, page = 0 }: Filters = {}) {
    return this.access('read', async query => {
      const rows = await query<NoteRow>(`SELECT ${noteFields} FROM suggestions
        WHERE (? IS NULL OR status = ?)
        ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`, [status ?? null, status ?? null, pageSize + 1, page * pageSize]);
      return { notes: rows.slice(0, pageSize).map(toNote), hasNext: rows.length > pageSize };
    });
  }

  review(input: ReviewRequest, now: number) {
    return this.access('write', async query => {
      const { id, version, status, summary, outcome, publish } = input;
      const [raw] = await query<NoteRow>(`SELECT ${noteFields} FROM suggestions WHERE id = ?`, [id]);
      if (!raw) throw new BasketError('This note is no longer in the basket.', 404);
      const current = toNote(raw);
      if (publish && (!current.allowRecap || !canShowRecap(status) || !summary || !outcome)) {
        throw new BasketError('A public recap needs permission, a Tried or Implemented status, and both recap fields.', 409);
      }
      if (current.status === status && current.summary === summary && current.outcome === outcome && current.published === publish) {
        return current;
      }
      if (current.version !== version) throw new BasketError('This note changed in another review. Reload the inbox to see it.', 409);

      const [row] = await query<NoteRow>(`UPDATE suggestions SET status = ?, summary = ?, outcome = ?,
        published_at = CASE WHEN ? THEN COALESCE(published_at, ?) ELSE NULL END,
        version = version + 1 WHERE id = ? RETURNING ${noteFields}`, [status, summary, outcome, Number(publish), now, id]);
      return toNote(row);
    });
  }

  showcase() {
    return this.access('read', async query => {
      const rows = await query<Recap>(`SELECT id, summary, outcome, status FROM suggestions
        WHERE published_at IS NOT NULL AND allow_recap = 1 AND post_public = 0 AND status IN ('tried', 'implemented')
        ORDER BY published_at DESC, id DESC`);
      return rows.map(row => ({ ...row }));
    });
  }
}

export function openBasket(connection: string | TursoConnection = '.sundays-basket/basket.sqlite') {
  return new BasketStore(typeof connection === 'string' ? sqliteAccess(connection) : tursoAccess(connection));
}
