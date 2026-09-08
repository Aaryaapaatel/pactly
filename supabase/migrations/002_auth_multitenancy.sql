-- Adds real auth + per-user data isolation to an existing Pactly database.
-- Existing rows (created before auth existed) are NOT deleted - this
-- migration assigns them to your account so nothing is lost.
--
-- Run this in two steps, in order.

-- ============================================================
-- STEP 1 - run this first, right now.
-- Adds nullable user_id columns so existing rows aren't broken.
-- ============================================================

alter table policies add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table conversations add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table promises add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- ============================================================
-- STOP HERE. Before running Step 2:
--
-- 1. Sign up for a Pactly account through the app's /login page
--    (this creates your row in auth.users).
-- 2. Find your new user id: in the Supabase dashboard, go to
--    Authentication -> Users, and copy the "UID" column for your account.
--    (Or run:  select id, email from auth.users;  in the SQL editor.)
-- 3. Replace 'REPLACE_WITH_YOUR_USER_ID' below with that UUID, in all
--    four places it appears, then run Step 2.
-- ============================================================

-- ============================================================
-- STEP 2 - run after signing up and replacing the placeholder UUID.
-- Assigns all existing (pre-auth) rows to your account, then locks the
-- schema down to enforce per-user isolation going forward.
-- ============================================================

update policies set user_id = 'REPLACE_WITH_YOUR_USER_ID' where user_id is null;
update conversations set user_id = 'REPLACE_WITH_YOUR_USER_ID' where user_id is null;
update promises set user_id = 'REPLACE_WITH_YOUR_USER_ID' where user_id is null;

alter table policies alter column user_id set not null;
alter table conversations alter column user_id set not null;
alter table promises alter column user_id set not null;

create index if not exists policies_user_id_idx on policies (user_id);
create index if not exists conversations_user_id_idx on conversations (user_id);
create index if not exists promises_user_id_idx on promises (user_id);

alter table policies enable row level security;
alter table conversations enable row level security;
alter table promises enable row level security;

create policy "users manage their own policy" on policies
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users manage their own conversations" on conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users manage their own promises" on promises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
