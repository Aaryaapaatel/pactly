-- Adds the company offerings/requirements list to the policies table.
-- Run this in the Supabase SQL editor if your project was set up before
-- this column was added to supabase/schema.sql.

alter table policies
  add column if not exists approved_offerings jsonb not null default '[]'::jsonb;

comment on table policies is 'Company policy rules used to flag risky promises. custom_rules is an array of {label, description}. approved_offerings is an array of {name, description} describing what the company actually offers, used to flag promises for products/features/plans that are not on the list.';
