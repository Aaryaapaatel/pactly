-- Adds API keys so a company's own backend can push conversations to
-- Pactly automatically (POST /api/ingest) instead of a human pasting them
-- in. Safe to run directly - this only adds a new table.

create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'API Key',
  key_hash text not null unique,
  key_prefix text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

comment on table api_keys is 'API keys for POST /api/ingest. Only a SHA-256 hash of the key is stored - the full key is shown once at creation and never again. key_prefix is the first few characters, kept in the clear so a user can tell keys apart in the UI.';

create index if not exists api_keys_user_id_idx on api_keys (user_id);
create index if not exists api_keys_key_hash_idx on api_keys (key_hash);

alter table api_keys enable row level security;

create policy "users manage their own api keys" on api_keys
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
