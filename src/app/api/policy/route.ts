import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getActivePolicy } from "@/lib/policy";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const policy = await getActivePolicy(supabase, user.id);
  return NextResponse.json({ policy });
}

const updatePolicySchema = z.object({
  max_discount_percent: z.number().min(0).max(100),
  standard_delivery_weeks: z.number().min(0),
  custom_rules: z
    .array(z.object({ label: z.string().min(1), description: z.string().min(1) }))
    .default([]),
  approved_offerings: z
    .array(z.object({ name: z.string().min(1), description: z.string().min(1) }))
    .default([]),
});

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = updatePolicySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const current = await getActivePolicy(supabase, user.id);

  const { data, error } = await supabase
    .from("policies")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", current.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ policy: data });
}
