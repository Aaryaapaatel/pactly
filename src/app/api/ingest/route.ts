import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { hashApiKey } from "@/lib/apiKeys";
import { getActivePolicy } from "@/lib/policy";
import { extractPromises } from "@/lib/extraction";
import { checkRateLimit } from "@/lib/rateLimit";
import { checkUsageAllowed } from "@/lib/subscription";
import type { ConversationWithPromises } from "@/types";

const RATE_LIMIT = 60;
const RATE_LIMIT_WINDOW_MINUTES = 60;

// Public, API-key-authenticated endpoint for automatic conversation
// ingestion - a company's own agent platform calls this the moment a
// conversation ends, instead of a human pasting it into the dashboard.
//
// Auth here is deliberately NOT a Supabase Auth session (there's no browser,
// no cookies, no logged-in user) - it's a bearer API key, verified by
// looking up its hash in api_keys. Every write below uses the user_id
// resolved from that lookup, never anything from the request body.

const ingestSchema = z.object({
  conversation_text: z
    .string()
    .min(1, "conversation_text is required.")
    .max(50000, "conversation_text must be 50,000 characters or fewer."),
  title: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const apiKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing API key. Send it as 'Authorization: Bearer <key>'." },
      { status: 401 }
    );
  }

  const keyHash = hashApiKey(apiKey);
  const { data: keyRow, error: keyError } = await supabaseAdmin
    .from("api_keys")
    .select("id, user_id")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (keyError || !keyRow) {
    return NextResponse.json({ error: "Invalid API key." }, { status: 401 });
  }

  const userId = keyRow.user_id as string;

  const rateLimit = await checkRateLimit(
    `apikey:${keyRow.id}`,
    "ingest",
    RATE_LIMIT,
    RATE_LIMIT_WINDOW_MINUTES
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Max ${RATE_LIMIT} requests per hour for this API key.` },
      { status: 429 }
    );
  }

  await supabaseAdmin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRow.id);

  const usage = await checkUsageAllowed(supabaseAdmin, userId);
  if (!usage.allowed) {
    return NextResponse.json(
      {
        error: `This account has used all ${usage.limit} free conversations this month. Upgrade to Pro for unlimited.`,
        upgrade_url: "/pricing",
      },
      { status: 402 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = ingestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { conversation_text, title } = parsed.data;

  const policy = await getActivePolicy(supabaseAdmin, userId);

  let extracted;
  try {
    extracted = await extractPromises(conversation_text, policy);
  } catch (err) {
    console.error("Ingest extraction failed:", err);
    return NextResponse.json(
      { error: "Failed to extract promises from the conversation." },
      { status: 502 }
    );
  }

  const { data: conversation, error: conversationError } = await supabaseAdmin
    .from("conversations")
    .insert({ user_id: userId, raw_text: conversation_text, title: title ?? null })
    .select("*")
    .single();

  if (conversationError) {
    return NextResponse.json({ error: conversationError.message }, { status: 500 });
  }

  const promiseRows = extracted.map((p) => ({
    user_id: userId,
    conversation_id: conversation.id,
    category: p.category,
    promise_text: p.promise_text,
    extracted_value: p.extracted_value,
    risk_flag: p.risk_flag,
    risk_reason: p.risk_reason,
  }));

  let promises = [];
  if (promiseRows.length > 0) {
    const { data: insertedPromises, error: promisesError } = await supabaseAdmin
      .from("promises")
      .insert(promiseRows)
      .select("*");

    if (promisesError) {
      return NextResponse.json({ error: promisesError.message }, { status: 500 });
    }
    promises = insertedPromises;
  }

  const result: ConversationWithPromises = { ...conversation, promises };
  return NextResponse.json({ conversation: result });
}
