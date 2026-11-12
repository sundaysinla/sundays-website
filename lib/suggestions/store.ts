import { randomUUID } from 'node:crypto';
import { chmodSync, closeSync, mkdirSync, openSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { BasketError, canShowRecap, COMMENT_PREVIEW, type BasketComment, type BasketNote, type DiscussionPage, type PublicPost, type Recap, type ReviewStatus, type Vote, type VoteState } from './model.ts';
import type { CommentRequest, DropRequest, ReviewRequest } from './requests.ts';

const pageSize = 16;
const commentPageSize = 10;
const rateWindow = 5 * 60_000;
const rateLimits = { drop: 30, 'sign-in': 8, comment: 60, vote: 240 };
const visiblePost = "post_public = 1 AND status <> 'archived'";
const noteFields = `id, note, allow_recap AS allowRecap, post_public AS publicPost, created_at AS createdAt, status,
  summary, outcome, published_at IS NOT NULL AS published, version`;

const schema = `
  CREATE TABLE IF NOT EXISTS suggestions (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL UNIQUE,
    note TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('idea', 'try', 'improve', 'love')),
    allow_recap INTEGER NOT NULL CHECK (allow_recap IN (0, 1)),
    post_public INTEGER NOT NULL DEFAULT 0 CHECK (post_public IN (0, 1)),
    created_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'considering', 'tried', 'implemented', 'archived')),
    summary TEXT NOT NULL DEFAULT '',
    outcome TEXT NOT NULL DEFAULT '',
    published_at INTEGER,
    version INTEGER NOT NULL DEFAULT 1,
    CHECK (published_at IS NULL OR (
      allow_recap = 1 AND status IN ('tried', 'implemented') AND length(summary) > 0 AND length(outcome) > 0
    ))
  );
  CREATE INDEX IF NOT EXISTS suggestions_by_date ON suggestions(created_at DESC, id DESC);
  CREATE TABLE IF NOT EXISTS suggestion_limits (
    scope TEXT PRIMARY KEY,
    started_at INTEGER NOT NULL,
    count INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS suggestion_comments (
    id INTEGER PRIMARY KEY,
    suggestion_id TEXT NOT NULL REFERENCES suggestions(id),
    request_id TEXT NOT NULL UNIQUE,
    body TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS suggestion_comments_by_post ON suggestion_comments(suggestion_id, id DESC);
  CREATE TABLE IF NOT EXISTS suggestion_votes (
    suggestion_id TEXT NOT NULL REFERENCES suggestions(id),
    voter_hash TEXT NOT NULL,
    value INTEGER NOT NULL CHECK (value IN (-1, 1)),
    PRIMARY KEY (suggestion_id, voter_hash)
  );
`;

type NoteRow = Omit<BasketNote, 'allowRecap' | 'publicPost' | 'published'> & {
  allowRecap: 0 | 1;
  publicPost: 0 | 1;
  published: 0 | 1;
};
type PublicPostRow = Omit<PublicPost, 'votes' | 'discussion'> & VoteState;
type Filters = { status?: ReviewStatus; page?: number };

function toNote(row: NoteRow): BasketNote {
  return { ...row, allowRecap: row.allowRecap === 1, publicPost: row.publicPost === 1, published: row.published === 1 };
}

function migratePublicConsent(db: DatabaseSync) {
  const column = db.prepare("SELECT 1 FROM pragma_table_info('suggestions') WHERE name = 'post_public'");
  if (column.get()) return;
  db.exec('BEGIN IMMEDIATE');
  // Another connection may have migrated while this one waited for the write lock.
  if (!column.get()) db.exec('ALTER TABLE suggestions ADD COLUMN post_public INTEGER NOT NULL DEFAULT 0 CHECK (post_public IN (0, 1))');
  db.exec('COMMIT');
}

function takeSlot(db: DatabaseSync, scope: keyof typeof rateLimits, now: number) {
  const row = db.prepare('SELECT started_at, count FROM suggestion_limits WHERE scope = ?').get(scope) as
    { started_at: number; count: number } | undefined;
  if (!row || now - row.started_at >= rateWindow) {
    db.prepare(`INSERT INTO suggestion_limits (scope, started_at, count) VALUES (?, ?, 1)
      ON CONFLICT(scope) DO UPDATE SET started_at = excluded.started_at, count = 1`).run(scope, now);
    return;
  }
  if (row.count >= rateLimits[scope]) throw new BasketError('Too many attempts. Try again in a few minutes.', 429);
  db.prepare('UPDATE suggestion_limits SET count = count + 1 WHERE scope = ?').run(scope);
}

function requirePublicPost(db: DatabaseSync, id: string) {
  if (!db.prepare(`SELECT 1 FROM suggestions WHERE id = ? AND ${visiblePost}`).get(id)) {
    throw new BasketError('This discussion is unavailable.', 404);
  }
}

function readDiscussion(db: DatabaseSync, id: string, limit: number, before?: number): DiscussionPage {
  const count = Number(db.prepare('SELECT COUNT(*) AS count FROM suggestion_comments WHERE suggestion_id = ?').get(id)?.count);
  const rows = db.prepare(`SELECT id, body, created_at AS createdAt FROM suggestion_comments
    WHERE suggestion_id = ? AND (? IS NULL OR id < ?) ORDER BY id DESC LIMIT ?`)
    .all(id, before ?? null, before ?? null, limit + 1) as BasketComment[];
  // SQLite rows have no prototype. Send plain objects across the React server/client boundary.
  const comments = rows.slice(0, limit).map(({ id, body, createdAt }) => ({ id, body, createdAt }));
  return { comments, count, before: rows.length > limit ? comments[comments.length - 1].id : null };
}

class SQLiteBasket {
  private readonly path: string;
  private readonly Database: typeof DatabaseSync;

  constructor(path: string, Database: typeof DatabaseSync) {
    this.path = path;
    this.Database = Database;
  }

  private access<T>(operation: (db: DatabaseSync) => T, write = false): T {
    mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 });
    closeSync(openSync(this.path, 'a', 0o600));
    chmodSync(this.path, 0o600);
    const db = new this.Database(this.path);
    try {
      db.exec('PRAGMA busy_timeout = 2500');
      db.exec(schema);
      migratePublicConsent(db);
      db.exec(write ? 'BEGIN IMMEDIATE' : 'BEGIN');
      const result = operation(db);
      db.exec('COMMIT');
      return result;
    } finally {
      // Closing an uncommitted connection rolls back its transaction.
      db.close();
    }
  }

  drop({ requestId, category = 'idea', note, allowRecap, publicPost }: DropRequest, now: number) {
    const recapConsent = Number(allowRecap === true);
    const publicConsent = Number(publicPost === true);
    return this.access(db => {
      const previous = db.prepare('SELECT id, note, category, allow_recap, post_public, status FROM suggestions WHERE request_id = ?').get(requestId);
      if (previous) {
        if (previous.note !== note || previous.category !== category || previous.allow_recap !== recapConsent || previous.post_public !== publicConsent) {
          throw new BasketError('This note changed. Try sending it again.', 409);
        }
        return publicPost && previous.status !== 'archived' ? { postId: String(previous.id) } : {};
      }
      takeSlot(db, 'drop', now);
      const id = randomUUID();
      db.prepare(`INSERT INTO suggestions (id, request_id, note, category, allow_recap, post_public, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, requestId, note, category, recapConsent, publicConsent, now);
      return publicPost ? { postId: id } : {};
    }, true);
  }

  publicFeed(voter: string | null, page = 0) {
    return this.access(db => {
      const rows = db.prepare(`SELECT id, note, created_at AS createdAt, status,
        COALESCE((SELECT SUM(value) FROM suggestion_votes WHERE suggestion_id = suggestions.id), 0) AS score,
        COALESCE((SELECT value FROM suggestion_votes WHERE suggestion_id = suggestions.id AND voter_hash = ?), 0) AS vote
        FROM suggestions WHERE ${visiblePost} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`)
        .all(voter, pageSize + 1, page * pageSize) as PublicPostRow[];
      const posts: PublicPost[] = rows.slice(0, pageSize).map(({ score, vote, ...post }) => ({
        ...post, votes: { score, vote }, discussion: readDiscussion(db, post.id, COMMENT_PREVIEW),
      }));
      return { posts, hasNext: rows.length > pageSize };
    });
  }

  comments(id: string, before?: number) {
    return this.access(db => {
      requirePublicPost(db, id);
      return readDiscussion(db, id, commentPageSize, before);
    });
  }

  addComment({ id, requestId, body }: CommentRequest, now: number) {
    return this.access(db => {
      requirePublicPost(db, id);
      const previous = db.prepare('SELECT suggestion_id, body FROM suggestion_comments WHERE request_id = ?').get(requestId);
      if (previous && (previous.suggestion_id !== id || previous.body !== body)) {
        throw new BasketError('This comment changed. Try sending it again.', 409);
      }
      if (!previous) {
        takeSlot(db, 'comment', now);
        db.prepare('INSERT INTO suggestion_comments (suggestion_id, request_id, body, created_at) VALUES (?, ?, ?, ?)')
          .run(id, requestId, body, now);
      }
      return readDiscussion(db, id, commentPageSize);
    }, true);
  }

  vote(id: string, voter: string, value: Vote, now: number): VoteState {
    return this.access(db => {
      requirePublicPost(db, id);
      const previous = db.prepare('SELECT value FROM suggestion_votes WHERE suggestion_id = ? AND voter_hash = ?').get(id, voter);
      if ((previous?.value ?? 0) !== value) {
        takeSlot(db, 'vote', now);
        if (value === 0) {
          db.prepare('DELETE FROM suggestion_votes WHERE suggestion_id = ? AND voter_hash = ?').run(id, voter);
        } else {
          db.prepare(`INSERT INTO suggestion_votes (suggestion_id, voter_hash, value) VALUES (?, ?, ?)
            ON CONFLICT(suggestion_id, voter_hash) DO UPDATE SET value = excluded.value`).run(id, voter, value);
        }
      }
      const score = Number(db.prepare('SELECT COALESCE(SUM(value), 0) AS score FROM suggestion_votes WHERE suggestion_id = ?').get(id)?.score);
      return { score, vote: value };
    }, true);
  }

  signInAttempt(now: number) {
    this.access(db => takeSlot(db, 'sign-in', now), true);
  }

  inbox({ status, page = 0 }: Filters = {}) {
    return this.access(db => {
      const rows = db.prepare(`SELECT ${noteFields} FROM suggestions
        WHERE (? IS NULL OR status = ?)
        ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`)
        .all(status ?? null, status ?? null, pageSize + 1, page * pageSize) as unknown as NoteRow[];
      return { notes: rows.slice(0, pageSize).map(toNote), hasNext: rows.length > pageSize };
    });
  }

  review(input: ReviewRequest, now: number): BasketNote {
    return this.access(db => {
      const { id, version, status, summary, outcome, publish } = input;
      const raw = db.prepare(`SELECT ${noteFields} FROM suggestions WHERE id = ?`).get(id) as NoteRow | undefined;
      if (!raw) throw new BasketError('This note is no longer in the basket.', 404);
      const current = toNote(raw);
      if (publish && (!current.allowRecap || !canShowRecap(status) || !summary || !outcome)) {
        throw new BasketError('A public recap needs permission, a Tried or Implemented status, and both recap fields.', 409);
      }
      if (current.status === status && current.summary === summary && current.outcome === outcome && current.published === publish) {
        return current;
      }
      if (current.version !== version) throw new BasketError('This note changed in another review. Reload the inbox to see it.', 409);

      const row = db.prepare(`UPDATE suggestions SET status = ?, summary = ?, outcome = ?,
        published_at = CASE WHEN ? THEN COALESCE(published_at, ?) ELSE NULL END,
        version = version + 1 WHERE id = ? RETURNING ${noteFields}`)
        .get(status, summary, outcome, Number(publish), now, id) as NoteRow;
      return toNote(row);
    }, true);
  }

  showcase() {
    return this.access(db => db.prepare(`SELECT id, summary, outcome, status FROM suggestions
      WHERE published_at IS NOT NULL AND allow_recap = 1 AND post_public = 0 AND status IN ('tried', 'implemented')
      ORDER BY published_at DESC, id DESC`).all() as Recap[]);
  }
}

export async function openBasket(path = process.env.SUGGESTIONS_BASKET_DB_PATH ?? '.sundays-basket/basket.sqlite') {
  // The disabled feature never loads SQLite on a hosted runtime.
  const { DatabaseSync } = await import('node:sqlite');
  return new SQLiteBasket(resolve(path), DatabaseSync);
}
