import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { hashApiKey } from "@/lib/apiKeys";
import { checkRateLimit } from "@/lib/rateLimit";
import { checkUsageAllowed } from "@/lib/subscription";
import { runIngestPipeline, ExtractionFailedError } from "@/lib/ingestPipeline";

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
//
// Kept as the original, simpler payload shape for backward compatibility;
// POST /api/v1/ingest accepts the fuller {conversation_id, transcript_text,
// platform, agent_flow} shape and calls the same pipeline.

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

  try {
    const conversation = await runIngestPipeline(supabaseAdmin, userId, parsed.data.conversation_text, {
      title: parsed.data.title,
    });
    return NextResponse.json({ conversation });
  } catch (err) {
    if (err instanceof ExtractionFailedError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    console.error("Ingest failed:", err);
    return NextResponse.json({ error: "Failed to ingest conversation." }, { status: 500 });
  }
}
