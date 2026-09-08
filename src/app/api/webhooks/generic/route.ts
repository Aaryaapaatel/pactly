import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveApiKey } from "@/lib/apiKeyAuth";
import { checkRateLimit } from "@/lib/rateLimit";
import { checkUsageAllowed } from "@/lib/subscription";
import { runIngestPipeline, ExtractionFailedError } from "@/lib/ingestPipeline";
import { supabaseAdmin } from "@/lib/supabase/admin";

// For any platform that can send a webhook with a custom Authorization
// header - point it here with {"Authorization": "Bearer <your Pactly API
// key>"} and this payload shape. This is functionally identical to
// POST /api/v1/ingest; it exists as a clearly-named "generic webhook"
// integration point separate from platform-specific ones.
const genericWebhookSchema = z.object({
  conversation_id: z.string().max(200).optional(),
  transcript_text: z.string().min(1).max(50000),
  platform: z.string().max(100).default("generic"),
  agent_flow: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const resolved = await resolveApiKey(request);
  if (!resolved) {
    return NextResponse.json({ error: "Missing or invalid API key." }, { status: 401 });
  }
  const { keyId, userId } = resolved;

  const rateLimit = await checkRateLimit(`apikey:${keyId}`, "webhook-generic", 60, 60);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  const usage = await checkUsageAllowed(supabaseAdmin, userId);
  if (!usage.allowed) {
    return NextResponse.json(
      { error: `Free plan limit reached. Upgrade to Pro for unlimited.`, upgrade_url: "/pricing" },
      { status: 402 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = genericWebhookSchema.safeParse(body);
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
    console.error("Generic webhook ingest failed:", err);
    return NextResponse.json({ error: "Failed to ingest conversation." }, { status: 500 });
  }
}
