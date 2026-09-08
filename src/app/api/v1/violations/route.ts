import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActivePolicy } from "@/lib/policy";

// Filterable list of violations (promises with risk_flag = true) for the
// signed-in user. There's no separate `violations` table - a violation is
// just a promise with risk_flag set, which keeps the extraction pipeline
// single-source-of-truth rather than writing the same row twice.
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const conversationId = searchParams.get("conversation_id");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const limit = Math.min(Number(searchParams.get("limit") ?? "50") || 50, 200);

  let query = supabase
    .from("promises")
    .select("*")
    .eq("user_id", user.id)
    .eq("risk_flag", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (category) query = query.eq("category", category);
  if (conversationId) query = query.eq("conversation_id", conversationId);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const policy = await getActivePolicy(supabase, user.id);

  const violations = data.map((p) => ({
    id: p.id,
    conversation_id: p.conversation_id,
    category: p.category,
    promise_text: p.promise_text,
    promised_value: p.extracted_value,
    allowed_value:
      p.category === "discount"
        ? `${policy.max_discount_percent}%`
        : p.category === "timeline"
          ? `${policy.standard_delivery_weeks} weeks`
          : null,
    rule_broken: p.risk_reason,
    created_at: p.created_at,
  }));

  return NextResponse.json({ violations, count: violations.length });
}
