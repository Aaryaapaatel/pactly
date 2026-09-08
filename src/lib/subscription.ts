import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Deliberately not imported from src/lib/stripe.ts - usage checks must work
// even when Stripe isn't configured, since billing is optional.
const FREE_PLAN_MONTHLY_CONVERSATION_LIMIT = 20;

export interface Subscription {
  user_id: string;
  plan: "free" | "pro";
  status: "active" | "past_due" | "canceled";
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
}

// No row means the user has never subscribed - treat that as the free plan
// rather than inserting a row for every signup.
export async function getSubscription(
  supabase: SupabaseClient,
  userId: string
): Promise<Subscription> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (data) return data as Subscription;

  return {
    user_id: userId,
    plan: "free",
    status: "active",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    current_period_end: null,
  };
}

// Enforces the free plan's monthly conversation cap. Pro (active) users are
// unlimited here - they're still bounded by the hourly rate limiter, which
// protects against abuse/cost runaway regardless of plan.
export async function checkUsageAllowed(
  supabase: SupabaseClient,
  userId: string
): Promise<{ allowed: boolean; used: number; limit: number | null }> {
  const subscription = await getSubscription(supabase, userId);

  // null limit = unlimited. Infinity doesn't survive the server/client
  // component boundary cleanly, so null is the serializable "no cap" value.
  if (subscription.plan === "pro" && subscription.status === "active") {
    return { allowed: true, used: 0, limit: null };
  }

  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfMonth.toISOString());

  if (error) throw error;

  const used = count ?? 0;
  return {
    allowed: used < FREE_PLAN_MONTHLY_CONVERSATION_LIMIT,
    used,
    limit: FREE_PLAN_MONTHLY_CONVERSATION_LIMIT,
  };
}
