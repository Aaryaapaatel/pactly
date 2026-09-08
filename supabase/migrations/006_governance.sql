-- Zero-retention for raw transcripts, PII redaction rules, and a durable
-- job queue for bulk ingestion (serverless has no persistent in-memory
-- queue - a DB-backed queue processed by a cron-triggered endpoint is the
-- only version of "queue that doesn't block the API" that actually works
-- on Vercel).

-- raw_text is purged (set to null) 24h after creation by a cron job hitting
-- GET /api/cron/purge-transcripts. Promises/violations are unaffected -
-- only the raw conversation text is removed. Allow null for this reason.
alter table conversations alter column raw_text drop not null;
alter table conversations add column if not exists transcript_purged_at timestamptz;

-- Richer ingest metadata (POST /api/v1/ingest): which platform the
-- conversation came from, the platform's own conversation id (for
-- dedup/lookup on their side), and a free-form agent_flow field.
alter table conversations add column if not exists platform text;
alter table conversations add column if not exists external_conversation_id text;
alter table conversations add column if not exists agent_flow text;

create index if not exists conversations_purge_lookup_idx
  on conversations (created_at)
  where transcript_purged_at is null;

-- Custom PII patterns a user wants redacted, in addition to the built-in
-- email/phone/credit-card regexes (src/lib/redaction.ts).
create table if not exists redaction_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  pattern text not null,
  created_at timestamptz not null default now()
);

alter table redaction_rules enable row level security;

create policy "users manage their own redaction rules" on redaction_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Durable bulk-ingest job queue. POST /api/v1/ingest/bulk inserts rows here
-- and returns immediately; GET /api/cron/process-ingest-queue (cron-triggered)
-- processes pending rows a few at a time per invocation.
create table if not exists ingest_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_text text not null,
  platform text,
  external_conversation_id text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists ingest_jobs_status_idx on ingest_jobs (status, created_at);

alter table ingest_jobs enable row level security;

create policy "users manage their own ingest jobs" on ingest_jobs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Optional, for the "$ saved" dashboard calculation: (promised discount -
-- allowed discount) * avg_order_value. Null until the user sets it.
alter table policies add column if not exists avg_order_value numeric;
