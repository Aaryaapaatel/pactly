import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local."
  );
}

// Service-role client that bypasses row level security. This exists ONLY
// for POST /api/ingest (src/app/api/ingest/route.ts), the one endpoint in
// the app with no Supabase Auth session to run as - it's authenticated by
// an API key from a company's own backend instead of a browser login.
//
// Rule for using this client: only ever act on a user_id that was just
// resolved server-side from a verified api_keys row. Never accept a user_id
// from request input, and never use this client for anything a normal
// logged-in request could do instead - those all go through
// src/lib/supabase/server.ts, which is scoped by the real RLS policies.
export const supabaseAdmin = createSupabaseClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});
