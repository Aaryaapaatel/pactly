# Pactly

AI agent accountability platform. Paste a sales conversation between an AI agent and a
customer (or send it automatically via the API), and Pactly extracts every promise,
commitment, price quote, delivery timeline, and discount the agent made — then flags
anything that conflicts with your company policy.

## Stack

- **Frontend:** Next.js 16 (App Router) + TypeScript + Tailwind CSS
- **Database & Auth:** Supabase (Postgres + Supabase Auth, email/password, row level security)
- **Extraction:** Anthropic Claude API (tool-use / structured extraction)
- **Billing:** Stripe (Checkout + Customer Portal + webhooks) — optional, the core product
  works without it configured

## How it works

1. You sign up / sign in. Every user has their own isolated policy, conversation history,
   and audit log — enforced at the database level with row level security, not just
   app-layer checks.
2. You paste a conversation transcript into the dashboard, or your own backend sends one
   automatically via `POST /api/ingest` with an API key (see **Settings → API keys**).
3. Claude extracts every promise (category, exact wording, value, and whether it looks
   like a policy risk) via a forced tool call, checked against your company policy — max
   discount, delivery window, custom rules, and your approved offerings list.
4. Numeric claims (discount %, delivery time) are also re-checked deterministically in
   code (`src/lib/extraction.ts`), so those two risk flags don't depend solely on the
   model's arithmetic.
5. The conversation and its extracted promises are saved and rendered in the audit log —
   searchable, filterable, exportable as CSV, deletable.

Free accounts get 20 conversations/month; the Pro plan ($49/month) is unlimited plus API
access. See `/pricing`.

## Project structure

```
src/
  middleware.ts                    Redirects signed-out requests away from protected routes
  app/
    page.tsx                       Public landing page
    dashboard/page.tsx             The app itself (paste + analyze + audit log + history)
    pricing/page.tsx                Plans, upgrade button
    login/page.tsx                  Sign in / sign up
    privacy/, terms/                 Legal pages
    policy/page.tsx                  Company policy editor (+ paste-a-doc auto-fill)
    settings/api-keys/page.tsx       Create/revoke API keys for automatic ingestion
    auth/callback/route.ts           Exchanges email-confirmation code for a session
    api/
      analyze/route.ts               POST: extract promises from a pasted conversation
      ingest/route.ts                POST: same, but API-key-authenticated for automation
      policy/route.ts                 GET/PUT the signed-in user's policy
      policy/extract/route.ts         POST: extract policy fields from a pasted document
      conversations/                  GET list + GET/DELETE one (history)
      export/route.ts                 GET: full audit log as CSV
      keys/                           API key create/list/revoke
      billing/checkout/, billing/portal/   Stripe Checkout + Customer Portal sessions
      webhooks/stripe/route.ts        Stripe webhook (signature-verified, updates plan)
  components/                        Dashboard, PolicyForm, ApiKeysManager, PricingCard, etc.
  lib/
    anthropic.ts                     Claude client
    extraction.ts                    Prompting, tool schemas, zod validation, policy overlay
    stripe.ts                        Stripe client (null if not configured - billing is optional)
    subscription.ts                  Plan lookup + monthly usage-cap enforcement
    rateLimit.ts                     Postgres-backed rate limiting for the Claude-calling routes
    apiKeys.ts                       API key generation/hashing (SHA-256, shown once)
    supabase/
      server.ts                       Server client bound to the session (RLS-enforced)
      client.ts                       Browser client, used only for sign in/up/out
      admin.ts                        Service-role client - ONLY for /api/ingest and Stripe webhook
      middleware.ts                   Session refresh + redirect logic
    policy.ts                        Fetch-or-create the signed-in user's active policy row
  types/index.ts                    Shared TS types
supabase/
  schema.sql                        Full schema for a fresh Supabase project
  migrations/                       Incremental changes for an already-provisioned project, in order
```

## Setup

### 1. Create a Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run [`supabase/schema.sql`](supabase/schema.sql) for a fresh project,
   or each file in [`supabase/migrations`](supabase/migrations) you haven't applied yet
   (in order) for an existing one.
3. From **Project Settings → API**, copy the **Project URL** and the **anon / publishable**
   key (never the service role key into `NEXT_PUBLIC_*` — see the security notes below).
4. Optional for local dev: **Authentication → Providers → Email**, turn off "Confirm email"
   so signup doesn't require clicking an email link.

### 2. Get an Anthropic API key

Create a key at [console.anthropic.com](https://console.anthropic.com).

### 3. (Optional) Set up Stripe billing

Skip this and the app still works — usage limits just won't be enforced past the free
tier, and the pricing page's upgrade button will show a "billing isn't configured" error.

1. Create a product + recurring monthly price in the [Stripe dashboard](https://dashboard.stripe.com/products) (or ask Claude to do it via the API once you've shared a secret key).
2. Get your secret key from **Developers → API keys**.
3. Add a webhook endpoint pointing at `<your-domain>/api/webhooks/stripe`, subscribed to
   `checkout.session.completed`, `customer.subscription.updated`, and
   `customer.subscription.deleted`. Copy its signing secret.

### 4. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`,
and `SUPABASE_SERVICE_ROLE_KEY` (used only by `/api/ingest` and the Stripe webhook — see
`src/lib/supabase/admin.ts`). Add the three `STRIPE_*` vars if you did step 3.

### 5. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Security notes

- Every table has row level security; the app has no client-facing service-role bypass.
  The two exceptions (`/api/ingest`, the Stripe webhook) resolve identity from a hashed
  API key or a signature-verified webhook, never from client-supplied data.
- The routes that call the paid Claude API are rate-limited (Postgres-backed, not
  in-memory — see `src/lib/rateLimit.ts`) and have max-length input validation.
- Standard security headers (CSP, HSTS, X-Frame-Options, etc.) are set in `next.config.ts`.
- No secret has ever been committed to this repo (checked including full git history).

## Notes / next steps

- No "team"/organization concept yet — auth is per-user, not per-company.
- No reduced-retention option — full raw transcripts are stored indefinitely.
- CAPTCHA on signup isn't wired in yet (Supabase Auth supports it natively, needs a
  Cloudflare Turnstile site key).
