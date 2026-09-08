import "server-only";
import { supabaseAdmin } from "./supabase/admin";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

// Postgres-backed rate limiting. An in-memory counter would not work
// correctly here - Vercel/serverless functions don't share memory across
// invocations or regions - so this counts rows in a shared table instead.
// Used only on routes that call the paid Claude API (analyze, ingest,
// policy/extract); Supabase Auth has its own built-in rate limiting on
// login/signup, which this app doesn't sit in front of.
export async function checkRateLimit(
  identifier: string,
  route: string,
  limit: number,
  windowMinutes: number
): Promise<RateLimitResult> {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  const { count, error } = await supabaseAdmin
    .from("rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("identifier", identifier)
    .eq("route", route)
    .gte("created_at", windowStart);

  if (error) {
    // Fail open rather than take the product down over a rate-limiter bug,
    // but this should never be silent - log it.
    console.error("Rate limit check failed:", error);
    return { allowed: true, remaining: limit };
  }

  const used = count ?? 0;
  if (used >= limit) {
    return { allowed: false, remaining: 0 };
  }

  await supabaseAdmin.from("rate_limit_events").insert({ identifier, route });
  return { allowed: true, remaining: limit - used - 1 };
}
