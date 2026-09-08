-- Pactly database schema
-- Run this in the Supabase SQL editor (or via `supabase db push`) to set up the project.
-- If your project was set up before auth/multi-tenancy was added, do not run
-- this file again - use supabase/migrations/002_auth_multitenancy.sql instead,
-- which preserves existing data.

create extension if not exists "pgcrypto";

-- Company policy, one active row per user. auth.uid() from Supabase Auth is
-- the tenant boundary - see the row level security policies below.
create table if not exists policies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  max_discount_percent numeric not null default 10,
  standard_delivery_weeks numeric not null default 4,
  custom_rules jsonb not null default '[]'::jsonb,
  approved_offerings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table policies is 'Company policy rules used to flag risky promises. custom_rules is an array of {label, description}. approved_offerings is an array of {name, description} describing what the company actually offers, used to flag promises for products/features/plans that are not on the list.';

-- One row per pasted conversation.
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  raw_text text not null,
  created_at timestamptz not null default now()
);

-- One row per extracted promise/commitment. user_id is denormalized from the
-- parent conversation so row level security policies stay simple (no join).
create table if not exists promises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  category text not null check (category in ('pricing', 'discount', 'timeline', 'feature', 'other')),
  promise_text text not null,
  extracted_value text,
  risk_flag boolean not null default false,
  risk_reason text,
  created_at timestamptz not null default now()
);

-- API keys for POST /api/ingest, so a company's own backend can push
-- conversations automatically instead of a human pasting them in. Only a
-- SHA-256 hash of the key is stored.
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

-- Backing store for server-side rate limiting on routes that call the paid
-- Claude API. RLS is enabled with no policies, on purpose: only the
-- service-role client (src/lib/rateLimit.ts) should ever touch this table.
create table if not exists rate_limit_events (
  id bigint generated always as identity primary key,
  identifier text not null,
  route text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_events_lookup_idx
  on rate_limit_events (identifier, route, created_at);

alter table rate_limit_events enable row level security;

-- Subscription/billing state. Different RLS shape from every other table on
-- purpose: users can SELECT their own row, but there is no insert/update/
-- delete policy for the user role - only the service-role client (Stripe
-- webhook + checkout routes) can ever change a user's plan.
create table if not exists subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  status text not null default 'active' check (status in ('active', 'past_due', 'canceled')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_stripe_customer_id_idx
  on subscriptions (stripe_customer_id);

alter table subscriptions enable row level security;

create policy "users can view their own subscription" on subscriptions
  for select using (auth.uid() = user_id);

create index if not exists policies_user_id_idx on policies (user_id);
create index if not exists conversations_user_id_idx on conversations (user_id);
create index if not exists promises_user_id_idx on promises (user_id);
create index if not exists promises_conversation_id_idx on promises (conversation_id);
create index if not exists promises_risk_flag_idx on promises (risk_flag);
create index if not exists api_keys_user_id_idx on api_keys (user_id);
create index if not exists api_keys_key_hash_idx on api_keys (key_hash);

-- Row Level Security: every table is scoped to the signed-in user. Almost
-- all queries in the app run as the authenticated user via
-- src/lib/supabase/server.ts, relying entirely on these policies for
-- isolation. The one exception is POST /api/ingest (src/lib/supabase/admin.ts),
-- which authenticates by API key instead of a login session and therefore
-- has no Supabase Auth user to run as - it uses a service-role client, but
-- only after resolving the key to a user_id server-side, and only to write
-- rows for that resolved user. See that file's comments for details.
alter table policies enable row level security;
alter table conversations enable row level security;
alter table promises enable row level security;
alter table api_keys enable row level security;

create policy "users manage their own policy" on policies
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users manage their own conversations" on conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users manage their own promises" on promises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users manage their own api keys" on api_keys
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
