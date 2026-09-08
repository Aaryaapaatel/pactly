-- Subscription/billing state, one row per user. Deliberately different RLS
-- shape from every other table: users can SELECT their own row (to show
-- plan status in the UI), but there is NO insert/update/delete policy for
-- the user role - only the service-role client (the Stripe webhook and
-- checkout routes) can ever change a user's plan. A user must never be able
-- to set their own plan directly, the same class of bug as trusting a
-- client-submitted price.

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
