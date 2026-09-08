import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getActivePolicy } from "./policy";
import { extractPromises } from "./extraction";
import { getCustomRedactionRules, redactPII } from "./redaction";
import { sendSlackAlert } from "./slack";
import type { ConversationWithPromises } from "@/types";

export class ExtractionFailedError extends Error {}

export interface IngestMetadata {
  title?: string | null;
  platform?: string | null;
  externalConversationId?: string | null;
  agentFlow?: string | null;
}

// Shared by POST /api/ingest and POST /api/v1/ingest - both authenticate
// differently (session vs. API key) but do the same thing once a userId is
// resolved: redact, extract, persist, alert. Callers pass whichever
// Supabase client matches their auth path (RLS-scoped session client, or
// the service-role admin client for API-key auth).
export async function runIngestPipeline(
  supabase: SupabaseClient,
  userId: string,
  conversationText: string,
  metadata: IngestMetadata = {}
): Promise<ConversationWithPromises> {
  const policy = await getActivePolicy(supabase, userId);

  let extracted;
  try {
    extracted = await extractPromises(conversationText, policy);
  } catch (err) {
    console.error("Ingest extraction failed:", err);
    throw new ExtractionFailedError("Failed to extract promises from the conversation.");
  }

  const customRedactionRules = await getCustomRedactionRules(supabase, userId);
  const redactedText = redactPII(conversationText, customRedactionRules);

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .insert({
      user_id: userId,
      raw_text: redactedText,
      title: metadata.title ?? null,
      platform: metadata.platform ?? null,
      external_conversation_id: metadata.externalConversationId ?? null,
      agent_flow: metadata.agentFlow ?? null,
    })
    .select("*")
    .single();

  if (conversationError) throw conversationError;

  const promiseRows = extracted.map((p) => ({
    user_id: userId,
    conversation_id: conversation.id,
    category: p.category,
    promise_text: p.promise_text,
    extracted_value: p.extracted_value,
    risk_flag: p.risk_flag,
    risk_reason: p.risk_reason,
  }));

  let promises: ConversationWithPromises["promises"] = [];
  if (promiseRows.length > 0) {
    const { data: insertedPromises, error: promisesError } = await supabase
      .from("promises")
      .insert(promiseRows)
      .select("*");

    if (promisesError) throw promisesError;
    promises = insertedPromises;
  }

  const violations = promises.filter((p) => p.risk_flag);
  if (violations.length > 0) {
    await sendSlackAlert(
      `🚩 Pactly: ${violations.length} policy violation(s) found in a conversation.\n` +
        violations.map((v) => `• [${v.category}] ${v.promise_text} — ${v.risk_reason}`).join("\n")
    );
  }

  return { ...conversation, promises };
}
