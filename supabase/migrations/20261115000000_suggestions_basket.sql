-- The Suggestions Basket. Safe to run more than once.
-- The app connects to Postgres directly with the server-only connection string.
-- The tables live in a private schema with row level security on, so Supabase's
-- public Data API and browser keys can never read or write them.

create schema if not exists basket;

create table if not exists basket.suggestions (
  id text primary key,
  request_id text not null unique,
  note text not null,
  category text not null check (category in ('idea', 'try', 'improve', 'love')),
  allow_recap boolean not null,
  post_public boolean not null default false,
  created_at bigint not null,
  status text not null default 'new' check (status in ('new', 'considering', 'tried', 'implemented', 'archived')),
  summary text not null default '',
  outcome text not null default '',
  published_at bigint,
  version integer not null default 1,
  check (published_at is null or (
    allow_recap and status in ('tried', 'implemented') and length(summary) > 0 and length(outcome) > 0
  ))
);
create index if not exists suggestions_by_date on basket.suggestions (created_at desc, id desc);

create table if not exists basket.suggestion_limits (
  scope text primary key,
  started_at bigint not null,
  count integer not null
);
create index if not exists suggestion_limits_by_start on basket.suggestion_limits (started_at);

create table if not exists basket.suggestion_comments (
  id bigint generated always as identity primary key,
  suggestion_id text not null references basket.suggestions (id),
  request_id text not null unique,
  body text not null,
  created_at bigint not null,
  hidden_at bigint
);
create index if not exists suggestion_comments_by_post on basket.suggestion_comments (suggestion_id, id desc);

create table if not exists basket.suggestion_votes (
  suggestion_id text not null references basket.suggestions (id),
  voter_hash text not null,
  value smallint not null check (value in (-1, 1)),
  primary key (suggestion_id, voter_hash)
);

alter table basket.suggestions enable row level security;
alter table basket.suggestion_limits enable row level security;
alter table basket.suggestion_comments enable row level security;
alter table basket.suggestion_votes enable row level security;

revoke all on schema basket from public;
revoke all on all tables in schema basket from public;
do $$
declare
  api_role text;
begin
  foreach api_role in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = api_role) then
      execute format('revoke all on schema basket from %I', api_role);
      execute format('revoke all on all tables in schema basket from %I', api_role);
      execute format('revoke all on all sequences in schema basket from %I', api_role);
    end if;
  end loop;
end
$$;
