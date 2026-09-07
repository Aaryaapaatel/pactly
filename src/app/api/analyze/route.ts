import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { getActivePolicy } from "@/lib/policy";
import { extractPromises } from "@/lib/extraction";
import type { ConversationWithPromises } from "@/types";

const analyzeSchema = z.object({
  conversation_text: z.string().min(1, "Conversation text is required."),
  title: z.string().optional(),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = analyzeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { conversation_text, title } = parsed.data;

  const policy = await getActivePolicy();

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
    .insert({ raw_text: conversation_text, title: title ?? null })
    .select("*")
    .single();

  if (conversationError) {
    return NextResponse.json({ error: conversationError.message }, { status: 500 });
  }

  const promiseRows = extracted.map((p) => ({
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
