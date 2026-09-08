import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parsePercent } from "./extraction";
import type { Policy } from "@/types";

// Rough estimate, not real accounting: for every flagged discount
// violation this month, (promised % - allowed %) * avg_order_value. Null
// if avg_order_value isn't set - there's nothing meaningful to estimate
// without it, and showing a fabricated number would be worse than showing
// nothing.
export async function calculateDollarsSaved(
  supabase: SupabaseClient,
  userId: string,
  policy: Policy
): Promise<number | null> {
  if (!policy.avg_order_value) return null;

  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("promises")
    .select("extracted_value")
    .eq("user_id", userId)
    .eq("category", "discount")
    .eq("risk_flag", true)
    .gte("created_at", startOfMonth.toISOString());

  if (error) throw error;

  let saved = 0;
  for (const row of data) {
    const promisedPercent = row.extracted_value ? parsePercent(row.extracted_value) : null;
    if (promisedPercent === null) continue;
    const excess = promisedPercent - policy.max_discount_percent;
    if (excess > 0) saved += (excess / 100) * policy.avg_order_value;
  }

  return saved;
}
