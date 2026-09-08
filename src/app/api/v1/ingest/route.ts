import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveApiKey } from "@/lib/apiKeyAuth";
import { checkRateLimit } from "@/lib/rateLimit";
import { checkUsageAllowed } from "@/lib/subscription";
import { runIngestPipeline, ExtractionFailedError } from "@/lib/ingestPipeline";
import { supabaseAdmin } from "@/lib/supabase/admin";

const RATE_LIMIT = 60;
const RATE_LIMIT_WINDOW_MINUTES = 60;

// Versioned ingest endpoint matching the {conversation_id, transcript_text,
// platform, timestamp, agent_flow} payload shape. Functionally identical
// to POST /api/ingest (same pipeline) - this exists as the stable,
// documented integration surface for external agent platforms.
const ingestSchema = z.object({
  conversation_id: z.string().max(200).optional(),
  transcript_text: z
    .string()
    .min(1, "transcript_text is required.")
    .max(50000, "transcript_text must be 50,000 characters or fewer."),
  platform: z.string().max(100).optional(),
  timestamp: z.string().optional(),
  agent_flow: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const resolved = await resolveApiKey(request);
  if (!resolved) {
    return NextResponse.json(
      { error: "Missing or invalid API key. Send it as 'Authorization: Bearer <key>'." },
      { status: 401 }
    );
  }
  const { keyId, userId } = resolved;

  const rateLimit = await checkRateLimit(`apikey:${keyId}`, "v1-ingest", RATE_LIMIT, RATE_LIMIT_WINDOW_MINUTES);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Max ${RATE_LIMIT} requests per hour for this API key.` },
      { status: 429 }
    );
  }

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
    const conversation = await runIngestPipeline(supabaseAdmin, userId, parsed.data.transcript_text, {
      platform: parsed.data.platform,
      externalConversationId: parsed.data.conversation_id,
      agentFlow: parsed.data.agent_flow,
    });
    return NextResponse.json({ conversation });
  } catch (err) {
    if (err instanceof ExtractionFailedError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    console.error("v1/ingest failed:", err);
    return NextResponse.json({ error: "Failed to ingest conversation." }, { status: 500 });
  }
}
