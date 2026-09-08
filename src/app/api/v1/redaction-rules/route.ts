import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const addRedactionRuleSchema = z.object({
  label: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/, "label must be alphanumeric (used in the redacted-<label> placeholder)."),
  pattern: z.string().min(1).max(500),
});

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("redaction_rules")
    .select("id, label, pattern, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rules: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = addRedactionRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    // Validates the pattern compiles - not using the instance itself.
    void new RegExp(parsed.data.pattern);
  } catch {
    return NextResponse.json({ error: "pattern is not a valid regular expression." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("redaction_rules")
    .insert({ user_id: user.id, label: parsed.data.label, pattern: parsed.data.pattern })
    .select("id, label, pattern, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule: data });
}
