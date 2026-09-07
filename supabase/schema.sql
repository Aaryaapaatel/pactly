-- Pactly database schema
-- Run this in the Supabase SQL editor (or via `supabase db push`) to set up the project.

create extension if not exists "pgcrypto";

-- Company policy singleton-ish table. We always read/write the most recently
-- created row; a default row is auto-created on first read if none exists.
create table if not exists policies (
  id uuid primary key default gen_random_uuid(),
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
  title text,
  raw_text text not null,
  created_at timestamptz not null default now()
);

-- One row per extracted promise/commitment.
create table if not exists promises (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  category text not null check (category in ('pricing', 'discount', 'timeline', 'feature', 'other')),
  promise_text text not null,
  extracted_value text,
  risk_flag boolean not null default false,
  risk_reason text,
  created_at timestamptz not null default now()
);

create index if not exists promises_conversation_id_idx on promises (conversation_id);
create index if not exists promises_risk_flag_idx on promises (risk_flag);

-- Row Level Security: disabled for this MVP (single-tenant, no auth yet).
-- All reads/writes happen through server-side API routes using the service
-- role key, so RLS is not enforced. Enable and add policies before adding
-- multi-tenant auth.
alter table policies disable row level security;
alter table conversations disable row level security;
alter table promises disable row level security;
