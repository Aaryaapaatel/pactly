# Pactly

AI agent accountability platform. Paste a sales conversation between an AI agent and a
customer, and Pactly extracts every promise, commitment, price quote, delivery timeline,
and discount the agent made — then flags anything that conflicts with your company policy.

## Stack

- **Frontend:** Next.js 16 (App Router) + TypeScript + Tailwind CSS
- **Database & Auth:** Supabase (Postgres + Supabase Auth, email/password)
- **Extraction:** Anthropic Claude API (tool-use / structured extraction)

## How it works

1. You sign up / sign in (email + password). Every user has their own isolated policy,
   conversation history, and audit log — enforced at the database level with row level
   security, not just app-layer checks.
2. You paste a conversation transcript into the dashboard.
3. `POST /api/analyze` sends the transcript and your current company policy — max
   discount, delivery window, custom rules, and your approved offerings list — to
   Claude, which returns a structured list of promises (category, exact wording,
   value, and whether it looks like a policy risk) via a forced tool call.
4. Numeric claims (discount %, delivery time) are also re-checked deterministically in
   code (`src/lib/extraction.ts`) against your policy, so risk flags for those two
   categories don't depend solely on the model's arithmetic. Promises for products,
   features, or plans that aren't on your approved offerings list are flagged by the
   model even when no numeric rule is broken.
5. The conversation and its extracted promises are saved to Supabase and rendered in the
   audit log.

## Project structure

```
src/
  middleware.ts                 Redirects signed-out requests to /login, refreshes session
  app/
    page.tsx                    Main dashboard (paste + analyze + audit log + history)
    login/page.tsx               Sign in / sign up
    auth/callback/route.ts       Exchanges email-confirmation code for a session
    policy/page.tsx              Company policy editor
    api/
      analyze/route.ts           POST: extract promises from a conversation, persist, return
      policy/route.ts            GET/PUT: read or update the signed-in user's policy
      conversations/             GET list + GET one (history)
  components/
    Dashboard.tsx                 Client-side paste/analyze/history UI, sign out
    AuditLog.tsx                  Renders extracted promises
    CategoryBadge.tsx              pricing / discount / timeline / feature / other
    RiskBadge.tsx                  compliant / policy risk
    PolicyForm.tsx                 Edit max discount, delivery window, custom rules, offerings list
  lib/
    anthropic.ts                   Claude client
    extraction.ts                  Prompting, tool schema, zod validation, policy overlay
    supabase/
      server.ts                     Server client bound to the request's session (RLS-enforced)
      client.ts                     Browser client, used only for sign in/up/out
      middleware.ts                 Session refresh + redirect logic used by src/middleware.ts
    policy.ts                       Fetch-or-create the signed-in user's active policy row
  types/index.ts                   Shared TS types
supabase/
  schema.sql                       Full schema for a fresh Supabase project
  migrations/                      Incremental changes for an already-provisioned project
```

## Setup

### 1. Create a Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run [`supabase/schema.sql`](supabase/schema.sql) to create the
   `policies`, `conversations`, and `promises` tables with row level security already
   configured. If you're updating an existing project instead, see
   [`supabase/migrations`](supabase/migrations) — run each file you haven't applied yet,
   in order (each one has instructions in its header comment).
3. From **Project Settings → API**, copy the **Project URL** and the **anon / publishable**
   key (not the service role key — the app never uses it; every query runs as the
   signed-in user and is enforced by row level security).
4. Email/password auth is on by default. If you want signup to work without email
   confirmation during local development, go to **Authentication → Providers → Email**
   and turn off "Confirm email".

### 2. Get an Anthropic API key

Create a key at [console.anthropic.com](https://console.anthropic.com).

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `ANTHROPIC_API_KEY`.

### 4. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to **/login**.
Sign up with an email and password, then you'll land on the dashboard. Paste a
conversation and click **Analyze conversation**. Visit **Company policy** to adjust the
max discount, standard delivery window, add custom rules (e.g. "no free support beyond
30 days"), or list your **approved offerings** (products, plans, features, and guarantees
the company actually provides) — any promise for something not on that list gets flagged
even if it doesn't break a numeric rule. Changes apply to conversations analyzed after
the change.

## Notes / next steps

- Each user's data (policy, conversations, promises) is fully isolated via Postgres row
  level security — there is no shared/global data anymore, and no service-role bypass in
  the app code.
- There's no "team" or "organization" concept yet — auth is per-user, not per-company. If
  multiple people at the same company need to share one policy and audit log, that needs
  an organizations/members layer on top of this.
- No API/webhook endpoint yet for automatic conversation ingestion — conversations are
  still pasted in manually.
- No conversation delete/filter/export tools yet.
- No reduced-retention option yet — full raw transcripts are stored indefinitely.
