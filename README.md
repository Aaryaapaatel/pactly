# Pactly

AI agent accountability platform. Paste a sales conversation between an AI agent and a
customer, and Pactly extracts every promise, commitment, price quote, delivery timeline,
and discount the agent made — then flags anything that conflicts with your company policy.

## Stack

- **Frontend:** Next.js 16 (App Router) + TypeScript + Tailwind CSS
- **Database:** Supabase (Postgres)
- **Extraction:** Anthropic Claude API (tool-use / structured extraction)

## How it works

1. You paste a conversation transcript into the dashboard.
2. `POST /api/analyze` sends the transcript and your current company policy — max
   discount, delivery window, custom rules, and your approved offerings list — to
   Claude, which returns a structured list of promises (category, exact wording,
   value, and whether it looks like a policy risk) via a forced tool call.
3. Numeric claims (discount %, delivery time) are also re-checked deterministically in
   code (`src/lib/extraction.ts`) against your policy, so risk flags for those two
   categories don't depend solely on the model's arithmetic. Promises for products,
   features, or plans that aren't on your approved offerings list are flagged by the
   model even when no numeric rule is broken.
4. The conversation and its extracted promises are saved to Supabase and rendered in the
   audit log.

## Project structure

```
src/
  app/
    page.tsx              Main dashboard (paste + analyze + audit log + history)
    policy/page.tsx        Company policy editor
    api/
      analyze/route.ts     POST: extract promises from a conversation, persist, return
      policy/route.ts      GET/PUT: read or update the active company policy
      conversations/       GET list + GET one (history)
  components/
    Dashboard.tsx           Client-side paste/analyze/history UI
    AuditLog.tsx            Renders extracted promises
    CategoryBadge.tsx        pricing / discount / timeline / feature / other
    RiskBadge.tsx            compliant / policy risk
    PolicyForm.tsx           Edit max discount, delivery window, custom rules, offerings list
  lib/
    anthropic.ts             Claude client
    extraction.ts            Prompting, tool schema, zod validation, policy overlay
    supabase.ts               Server-only Supabase client (service role key)
    policy.ts                 Fetch-or-create the active policy row
  types/index.ts               Shared TS types
supabase/schema.sql             Database schema (run this in Supabase)
```

## Setup

### 1. Create a Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run [`supabase/schema.sql`](supabase/schema.sql) to create the
   `policies`, `conversations`, and `promises` tables. If you set up the project before
   the approved offerings feature was added, instead run
   [`supabase/migrations/001_approved_offerings.sql`](supabase/migrations/001_approved_offerings.sql)
   to add the new column.
3. From **Project Settings → API**, copy the **Project URL** and the **service_role**
   secret key (not the anon key — the app writes to the database from server-side API
   routes only).

### 2. Get an Anthropic API key

Create a key at [console.anthropic.com](https://console.anthropic.com).

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `ANTHROPIC_API_KEY`.

### 4. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Paste a conversation and click
**Analyze conversation**. Visit **Company policy** to adjust the max discount, standard
delivery window, add custom rules (e.g. "no free support beyond 30 days"), or list your
**approved offerings** (products, plans, features, and guarantees the company actually
provides) — any promise for something not on that list gets flagged even if it doesn't
break a numeric rule. Changes apply to conversations analyzed after the change.

## Notes / next steps

- This MVP is single-tenant with no auth: RLS is disabled and there's one active policy
  record shared by everyone who can reach the app. Add Supabase Auth + RLS policies
  scoped by `user_id` before using this with real customer data or multiple orgs.
- The service role key is used server-side only (API routes), never exposed to the
  browser.
