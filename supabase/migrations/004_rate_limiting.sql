-- Backing store for rate limiting on the routes that call the paid Claude
-- API (analyze, ingest, policy/extract). An in-memory counter would not
-- work correctly on serverless - each invocation can be a fresh instance
-- with no shared memory - so this uses the database instead, which is
-- shared and persistent.
--
-- RLS is enabled with NO policies, which is deliberate: this table should
-- only ever be touched by the service-role client (src/lib/rateLimit.ts),
-- never by a user's own session, even though it's a table users have no
-- direct product reason to read or write.

create table if not exists rate_limit_events (
  id bigint generated always as identity primary key,
  identifier text not null,
  route text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_events_lookup_idx
  on rate_limit_events (identifier, route, created_at);

alter table rate_limit_events enable row level security;
