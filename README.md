# Pactly

AI agent accountability / promise-governance platform. Paste a sales conversation between
an AI agent and a customer — or have your own backend send it automatically — and Pactly
extracts every promise, commitment, price quote, delivery timeline, and discount the
agent made, checks it against your company policy, and flags anything that breaks it. It
can also block a draft response in real time before it's sent, in the narrower set of
cases (discount %, delivery timeline) that a deterministic check can catch fast enough.

## Stack

- **Frontend:** Next.js 16 (App Router) + TypeScript + Tailwind CSS
- **Database & Auth:** Supabase (Postgres + Supabase Auth, email/password, row level security)
- **Extraction:** Anthropic Claude API (tool-use / structured extraction)
- **Billing:** Stripe (Checkout + Customer Portal + webhooks) — optional, the core product
  works without it configured

## How it works

1. You sign up / sign in. Every user has their own isolated policy, conversation history,
   and audit log — enforced at the database level with row level security.
2. A conversation gets in via one of four paths: pasted into the dashboard, sent via
   `POST /api/ingest` or `POST /api/v1/ingest` with an API key, pushed in bulk via
   `POST /api/v1/ingest/bulk`, or received on `POST /api/webhooks/generic`.
3. Before anything is stored, built-in regexes redact emails, phone numbers, and credit
   card numbers from the transcript (plus any custom patterns you add via
   `POST /api/v1/redaction-rules`) — extraction itself still runs on the original text,
   so accuracy isn't affected, only what's persisted to disk.
4. Claude extracts every promise via a forced tool call, checked against your policy —
   max discount, delivery window, custom rules (editable via the dashboard or
   `POST /api/v1/rules`/`PUT /api/v1/policy`), and your approved offerings list.
5. Numeric claims (discount %, delivery time) are also re-checked deterministically in
   code (`src/lib/extraction.ts`), so those two risk flags don't depend solely on the
   model's arithmetic.
6. The conversation and its extracted promises are saved. If any are flagged and
   `SLACK_WEBHOOK_URL` is set, a Slack alert fires. Everything is browsable in the
   dashboard, or queryable via `GET /api/v1/violations`, or exportable as CSV.
7. **24 hours later**, a cron job wipes the raw transcript text (`raw_text` → null) —
   the conversation row and its extracted promises/violations are unaffected and stay
   forever; only the original text is deleted.

Free accounts get 20 conversations/month; the Pro plan ($49/month) is unlimited plus API
access. See `/pricing`.

## API reference

All API-key routes take `Authorization: Bearer <key>` (create one at
**Settings → API keys**). Session routes (used by the dashboard itself) aren't listed
here — see the project structure below.

| Route | Auth | What it does |
|---|---|---|
| `POST /api/v1/ingest` | API key | `{conversation_id, transcript_text, platform, agent_flow}` → extract + store |
| `POST /api/v1/ingest/bulk` | API key | Up to 1000 conversations at once; processed async by a cron job, not inline |
| `POST /api/webhooks/generic` | API key | Same shape as `/api/v1/ingest`, for platforms that can only send a plain webhook |
| `POST /api/webhooks/intercom`, `/zendesk` | — | **Stubs, return 501.** Their real webhook payload shapes need verifying against Intercom/Zendesk's actual docs before these can safely parse a transcript out of them — see the comments in those files |
| `POST /api/v1/check` | API key | `{draft_response_text}` → `{block, reason, suggested_fix}`. Deterministic only (discount %/timeline) — an LLM call can't reliably meet the latency budget, see below |
| `GET /api/v1/violations` | Session | Filterable list (`category`, `conversation_id`, `from`, `to`) |
| `GET/POST /api/v1/rules` | Session | List / add one custom policy rule in plain English |
| `GET/PUT /api/v1/policy` | API key | Read/update the whole policy — send exact fields, or `{document_text}` to have Claude extract it |
| `GET/POST /api/v1/redaction-rules` | Session | List / add a custom PII regex pattern |
| `GET /api/export` | Session | Full audit log as CSV |

### Real-time blocking: the actual latency tradeoff

`POST /api/v1/check` is meant to run inline before an agent sends a reply. It does
**not** call Claude — an LLM round-trip realistically takes over a second, which cannot
meet a sub-second SLA. Instead it only re-runs the same deterministic discount-%/
delivery-timeline checks used elsewhere, wrapped in an enforced 280ms timeout, and
**fails open** (returns `block: false`) on any error or timeout — a bug in Pactly must
never be the reason a real customer-facing response gets stuck. This means it does *not*
catch feature/offering violations synchronously; those still need the full async
pipeline (`/api/ingest` or `/api/v1/ingest`) that runs after the fact.

## Curl examples

```bash
# Ingest a conversation
curl -X POST https://<your-domain>/api/v1/ingest \
  -H "Authorization: Bearer pk_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "conversation_id": "conv_123",
    "transcript_text": "Agent: I can do 25% off for you today. Customer: Great!",
    "platform": "custom",
    "agent_flow": "sales-bot-v2"
  }'

# Real-time check before sending a draft reply
curl -X POST https://<your-domain>/api/v1/check \
  -H "Authorization: Bearer pk_live_..." \
  -H "Content-Type: application/json" \
  -d '{"draft_response_text": "I can offer you 30% off if you sign today."}'
# -> {"block":true,"reason":"Discount of 30% exceeds the maximum allowed discount of 10%.","suggested_fix":"Offer at most 10% instead."}

# List this month's violations
curl "https://<your-domain>/api/v1/violations?category=discount" \
  -H "Authorization: Bearer <your Supabase session cookie, or call this from the dashboard>"
```

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
    settings/api-keys/page.tsx       Create/revoke API keys
    auth/callback/route.ts           Exchanges email-confirmation code for a session
    api/
      analyze/route.ts               POST: extract promises from a pasted conversation (session auth)
      ingest/route.ts                POST: same, API-key auth, original payload shape
      v1/ingest/, v1/ingest/bulk/     Versioned ingest + bulk queue-based ingest
      v1/check/route.ts               Real-time deterministic block/allow check
      v1/violations/route.ts          Filterable violations list
      v1/rules/, v1/policy/            Policy management (plain-English rule add / full read-write)
      v1/redaction-rules/route.ts      Custom PII redaction patterns
      webhooks/generic/, intercom/, zendesk/   Generic (real) + platform stubs
      webhooks/stripe/route.ts        Stripe webhook (signature-verified, updates plan)
      cron/purge-transcripts/          24h raw-transcript auto-delete (Vercel Cron)
      cron/process-ingest-queue/       Drains the bulk-ingest job queue (Vercel Cron)
      policy/route.ts, policy/extract/   Dashboard's own policy read/update + doc-to-policy extraction
      conversations/, export/, keys/    History, CSV export, API key CRUD
      billing/checkout/, billing/portal/   Stripe Checkout + Customer Portal sessions
  components/                        Dashboard, PolicyForm, ApiKeysManager, PricingCard, etc.
  lib/
    anthropic.ts                     Claude client + TRAINING_ENABLED flag (see below)
    extraction.ts                    Prompting, tool schemas, zod validation, policy overlay
    ingestPipeline.ts                 Shared redact → extract → store → alert pipeline
    redaction.ts                      PII regex redaction (built-in + custom per-user patterns)
    slack.ts                          Optional Slack alert on violation
    stripe.ts                        Stripe client (null if not configured - billing is optional)
    subscription.ts                  Plan lookup + monthly usage-cap enforcement
    dollarsSaved.ts                   "$ saved this month" dashboard estimate
    rateLimit.ts                     Postgres-backed rate limiting for the Claude-calling routes
    apiKeys.ts, apiKeyAuth.ts         API key generation/hashing + shared auth resolution
    supabase/
      server.ts                       Server client bound to the session (RLS-enforced)
      client.ts                       Browser client, used only for sign in/up/out
      admin.ts                        Service-role client - ONLY for API-key/webhook/cron routes
      middleware.ts                   Session refresh + redirect logic
    policy.ts                        Fetch-or-create the signed-in user's active policy row
  types/index.ts                    Shared TS types
supabase/
  schema.sql                        Full schema for a fresh Supabase project
  migrations/                       Incremental changes for an already-provisioned project, in order
vercel.json                         Cron schedules for the two cron routes above
Dockerfile                          Self-hosted / VPC build (see below) - Vercel doesn't use this
```

## Setup

### 1. Create a Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run [`supabase/schema.sql`](supabase/schema.sql) for a fresh project,
   or each file in [`supabase/migrations`](supabase/migrations) you haven't applied yet
   (in order) for an existing one.
3. From **Project Settings → API**, copy the **Project URL** and the **anon / publishable**
   key (never the service role key into `NEXT_PUBLIC_*` — see the security notes below).
4. Optional for local dev: **Authentication → Providers → Email**, turn off "Confirm email".

### 2. Get an Anthropic API key

Create a key at [console.anthropic.com](https://console.anthropic.com).

### 3. (Optional) Set up Stripe billing

Skip this and the app still works — usage limits just won't be enforced past the free
tier, and the pricing page's upgrade button will show a "billing isn't configured" error.

1. Create a product + recurring monthly price in the [Stripe dashboard](https://dashboard.stripe.com/products).
2. Get your secret key from **Developers → API keys**.
3. Add a webhook endpoint pointing at `<your-domain>/api/webhooks/stripe`, subscribed to
   `checkout.session.completed`, `customer.subscription.updated`, and
   `customer.subscription.deleted`. Copy its signing secret.

### 4. Configure environment variables

```bash
cp .env.local.example .env.local
```

Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` (used only by API-key/webhook/cron routes — see
`src/lib/supabase/admin.ts`), and `CRON_SECRET` (any long random string — Vercel sends it
automatically as a Bearer token to your cron routes once set; generate one with
`openssl rand -hex 32`). Optional: the three `STRIPE_*` vars, `SLACK_WEBHOOK_URL`.

### 5. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Cron jobs (production only)

`vercel.json` schedules `GET /api/cron/purge-transcripts` (hourly) and
`GET /api/cron/process-ingest-queue` (every 10 min). **Vercel's Hobby plan may only
actually run cron jobs once a day regardless of the schedule string** — if you need
real hourly/10-minute execution, either upgrade to Pro or point an external scheduler
(e.g. a GitHub Actions cron workflow, or a free service like cron-job.org) at those two
URLs with `Authorization: Bearer <CRON_SECRET>` instead.

## VPC / self-hosted deployment

`Dockerfile` builds a self-hostable image (Next.js standalone output) for running Pactly
inside your own VPC instead of Vercel. Be precise about what this does and doesn't mean:
**self-hosting Pactly keeps your database and application server inside infrastructure
you control, but promise extraction still requires one external call per conversation to
Anthropic's Claude API** — there is no way to eliminate that call without self-hosting an
LLM, which this project doesn't do. Anthropic's API does not train on API request data by
default under its commercial terms (see `TRAINING_ENABLED` in `src/lib/anthropic.ts`),
but the transcript text is still transmitted to Anthropic's servers for extraction,
VPC-hosted or not. Don't claim otherwise in a security questionnaire.

## Security notes

- Every table has row level security. The exceptions — `/api/ingest`/`/api/v1/*`/
  webhooks (API-key auth) and the Stripe webhook (signature-verified) and the two cron
  routes (shared-secret auth) — resolve identity from something verified server-side,
  never from client-supplied data, and use the service-role client deliberately and
  narrowly for that reason (see `src/lib/supabase/admin.ts`).
- The routes that call the paid Claude API are rate-limited (Postgres-backed, not
  in-memory — an in-memory limiter silently doesn't work on serverless) and have
  max-length input validation.
- Standard security headers (CSP, HSTS, X-Frame-Options, etc.) are set in `next.config.ts`.
- No secret has ever been committed to this repo (checked including full git history).
- PII (emails, phones, card numbers) is redacted before storage, not before extraction.

## Notes / next steps

- No "team"/organization concept yet — auth is per-user, not per-company.
- No policy version history — you can't currently prove what your policy said on a past
  date, only what it says right now. Worth adding if this becomes evidence for anything.
- The "immutable audit ledger" idea and the existing delete-a-conversation feature are in
  tension: conversations can still be deleted from the dashboard, which removes their
  promises/violations too. That was a deliberate earlier feature request; true
  immutability (no delete, ever) would mean removing it.
- CAPTCHA on signup isn't wired in yet (Supabase Auth supports it natively, needs a
  Cloudflare Turnstile site key).
- Intercom/Zendesk webhook handlers are stubs (501) — see the "API reference" table above.
