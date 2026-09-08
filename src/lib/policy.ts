import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Policy } from "@/types";

const DEFAULT_MAX_DISCOUNT_PERCENT = 10;
const DEFAULT_STANDARD_DELIVERY_WEEKS = 4;

// Returns the signed-in user's most recently created policy row, creating a
// default one on first use. Each user has their own policy; this app treats
// it as a single active record per user rather than a full history.
export async function getActivePolicy(
  supabase: SupabaseClient,
  userId: string
): Promise<Policy> {
  const { data, error } = await supabase
    .from("policies")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (data) return data as Policy;

  const { data: created, error: createError } = await supabase
    .from("policies")
    .insert({
      user_id: userId,
      max_discount_percent: DEFAULT_MAX_DISCOUNT_PERCENT,
      standard_delivery_weeks: DEFAULT_STANDARD_DELIVERY_WEEKS,
      custom_rules: [],
      approved_offerings: [],
    })
    .select("*")
    .single();

  if (createError) throw createError;
  return created as Policy;
}
