import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getActivePolicy } from "@/lib/policy";
import { extractPromises } from "@/lib/extraction";
import { checkRateLimit } from "@/lib/rateLimit";
import type { ConversationWithPromises } from "@/types";

const RATE_LIMIT = 20;
const RATE_LIMIT_WINDOW_MINUTES = 60;

const analyzeSchema = z.object({
  conversation_text: z
    .string()
    .min(1, "Conversation text is required.")
    .max(50000, "Conversation text must be 50,000 characters or fewer."),
  title: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(
    `user:${user.id}`,
    "analyze",
    RATE_LIMIT,
    RATE_LIMIT_WINDOW_MINUTES
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Max ${RATE_LIMIT} analyses per hour.` },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = analyzeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { conversation_text, title } = parsed.data;

  const policy = await getActivePolicy(supabase, user.id);

  let extracted;
  try {
    extracted = await extractPromises(conversation_text, policy);
  } catch (err) {
    console.error("Extraction failed:", err);
    return NextResponse.json(
      { error: "Failed to extract promises from the conversation." },
      { status: 502 }
    );
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .insert({ user_id: user.id, raw_text: conversation_text, title: title ?? null })
    .select("*")
    .single();

  if (conversationError) {
    return NextResponse.json({ error: conversationError.message }, { status: 500 });
  }

  const promiseRows = extracted.map((p) => ({
    user_id: user.id,
    conversation_id: conversation.id,
    category: p.category,
    promise_text: p.promise_text,
    extracted_value: p.extracted_value,
    risk_flag: p.risk_flag,
    risk_reason: p.risk_reason,
  }));

  let promises = [];
  if (promiseRows.length > 0) {
    const { data: insertedPromises, error: promisesError } = await supabase
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
