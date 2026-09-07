import "server-only";
import { supabase } from "./supabase";
import type { Policy } from "@/types";

const DEFAULT_MAX_DISCOUNT_PERCENT = 10;
const DEFAULT_STANDARD_DELIVERY_WEEKS = 4;

// Returns the most recently created policy row, creating a default one on
// first use. The app treats policies as a single active record rather than
// a full history for this MVP.
export async function getActivePolicy(): Promise<Policy> {
  const { data, error } = await supabase
    .from("policies")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (data) return data as Policy;

  const { data: created, error: createError } = await supabase
    .from("policies")
    .insert({
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
