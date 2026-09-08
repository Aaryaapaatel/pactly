import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveApiKey } from "@/lib/apiKeyAuth";
import { checkRateLimit } from "@/lib/rateLimit";
import { getActivePolicy } from "@/lib/policy";
import { extractPolicyFromText } from "@/lib/extraction";
import { supabaseAdmin } from "@/lib/supabase/admin";

// API-key-authenticated policy read/update, so a company's own system can
// keep Pactly in sync automatically whenever their real policy changes -
// the same "no human has to log in and do it" pattern as /api/v1/ingest.
// This is additive: the dashboard's manual policy editor (PUT /api/policy,
// session-authenticated) keeps working exactly as before. Both paths write
// to the same policy row.

const ruleSchema = z.object({
  label: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
});
const offeringSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
});

// Either send the exact fields to change (partial - only provided fields
// are updated), or send document_text and let Claude extract them, the
// same way the dashboard's "paste a policy document" feature does.
const updateSchema = z.union([
  z.object({
    document_text: z.string().min(1).max(20000),
  }),
  z
    .object({
      max_discount_percent: z.number().min(0).max(100).optional(),
      standard_delivery_weeks: z.number().min(0).max(520).optional(),
      custom_rules: z.array(ruleSchema).max(50).optional(),
      approved_offerings: z.array(offeringSchema).max(50).optional(),
    })
    .refine((v) => Object.keys(v).length > 0, "At least one field is required."),
]);

export async function GET(request: Request) {
  const resolved = await resolveApiKey(request);
  if (!resolved) {
    return NextResponse.json({ error: "Missing or invalid API key." }, { status: 401 });
  }

  const policy = await getActivePolicy(supabaseAdmin, resolved.userId);
  return NextResponse.json({ policy });
}

export async function PUT(request: Request) {
  const resolved = await resolveApiKey(request);
  if (!resolved) {
    return NextResponse.json({ error: "Missing or invalid API key." }, { status: 401 });
  }
  const { keyId, userId } = resolved;

  const rateLimit = await checkRateLimit(`apikey:${keyId}`, "v1-policy", 30, 60);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const current = await getActivePolicy(supabaseAdmin, userId);

  let updateFields: Record<string, unknown>;
  if ("document_text" in parsed.data) {
    let draft;
    try {
      draft = await extractPolicyFromText(parsed.data.document_text);
    } catch (err) {
      console.error("v1/policy document extraction failed:", err);
      return NextResponse.json({ error: "Failed to extract policy from document_text." }, { status: 502 });
    }
    updateFields = {
      ...(draft.max_discount_percent !== null && { max_discount_percent: draft.max_discount_percent }),
      ...(draft.standard_delivery_weeks !== null && { standard_delivery_weeks: draft.standard_delivery_weeks }),
      ...(draft.custom_rules.length > 0 && {
        custom_rules: [...current.custom_rules, ...draft.custom_rules],
      }),
      ...(draft.approved_offerings.length > 0 && {
        approved_offerings: [...current.approved_offerings, ...draft.approved_offerings],
      }),
    };
  } else {
    updateFields = parsed.data;
  }

  const { data, error } = await supabaseAdmin
    .from("policies")
    .update({ ...updateFields, updated_at: new Date().toISOString() })
    .eq("id", current.id)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ policy: data });
}
