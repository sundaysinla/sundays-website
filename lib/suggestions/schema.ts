import type { Query } from './database.ts';

const schema = [
  `CREATE TABLE IF NOT EXISTS suggestions (
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
  )`,
  'CREATE INDEX IF NOT EXISTS suggestions_by_date ON suggestions(created_at DESC, id DESC)',
  `CREATE TABLE IF NOT EXISTS suggestion_limits (
    scope TEXT PRIMARY KEY,
    started_at INTEGER NOT NULL,
    count INTEGER NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS suggestion_limits_by_start ON suggestion_limits(started_at)',
  `CREATE TABLE IF NOT EXISTS suggestion_comments (
    id INTEGER PRIMARY KEY,
    suggestion_id TEXT NOT NULL REFERENCES suggestions(id),
    request_id TEXT NOT NULL UNIQUE,
    body TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    hidden_at INTEGER
  )`,
  'CREATE INDEX IF NOT EXISTS suggestion_comments_by_post ON suggestion_comments(suggestion_id, id DESC)',
  `CREATE TABLE IF NOT EXISTS suggestion_votes (
    suggestion_id TEXT NOT NULL REFERENCES suggestions(id),
    voter_hash TEXT NOT NULL,
    value INTEGER NOT NULL CHECK (value IN (-1, 1)),
    PRIMARY KEY (suggestion_id, voter_hash)
  )`,
];

export const localSchemaVersion = 1;

export async function migrateBasket(query: Query) {
  for (const statement of schema) await query(statement);

  const consent = await query("SELECT 1 FROM pragma_table_info('suggestions') WHERE name = 'post_public'");
  if (!consent.length) {
    await query('ALTER TABLE suggestions ADD COLUMN post_public INTEGER NOT NULL DEFAULT 0 CHECK (post_public IN (0, 1))');
  }
  const moderation = await query("SELECT 1 FROM pragma_table_info('suggestion_comments') WHERE name = 'hidden_at'");
  if (!moderation.length) {
    await query('ALTER TABLE suggestion_comments ADD COLUMN hidden_at INTEGER');
  }
}
