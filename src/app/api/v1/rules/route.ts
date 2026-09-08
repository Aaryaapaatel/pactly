import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getActivePolicy } from "@/lib/policy";

// Rules live inside policies.custom_rules (a jsonb array), not a separate
// table - this endpoint appends one rule to that array rather than
// managing a standalone `rules` table, so the existing policy-check logic
// (src/lib/extraction.ts) picks it up automatically with no extra join.
const addRuleSchema = z.object({
  rule_text_english: z.string().min(1).max(1000),
  label: z.string().min(1).max(200).optional(),
});

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const policy = await getActivePolicy(supabase, user.id);
  return NextResponse.json({
    rules: policy.custom_rules,
    max_discount_percent: policy.max_discount_percent,
    standard_delivery_weeks: policy.standard_delivery_weeks,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = addRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const policy = await getActivePolicy(supabase, user.id);
  const newRule = {
    label: parsed.data.label ?? parsed.data.rule_text_english.slice(0, 50),
    description: parsed.data.rule_text_english,
  };

  if (policy.custom_rules.length >= 50) {
    return NextResponse.json({ error: "Maximum of 50 custom rules." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("policies")
    .update({
      custom_rules: [...policy.custom_rules, newRule],
      updated_at: new Date().toISOString(),
    })
    .eq("id", policy.id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ policy: data });
}
