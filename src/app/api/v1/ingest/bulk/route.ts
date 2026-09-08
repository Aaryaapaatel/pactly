import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveApiKey } from "@/lib/apiKeyAuth";
import { checkRateLimit } from "@/lib/rateLimit";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Accepts up to 1000 conversations and returns immediately (202) with a
// batch id - processing happens out-of-band via GET /api/cron/process-
// ingest-queue. This is a deliberate substitution for the "in-memory queue"
// the spec suggested: on Vercel serverless, a function can be frozen the
// instant it returns a response, so anything not durably persisted before
// that point isn't reliably processed. A DB-backed queue, drained by a
// cron-triggered endpoint, is the version of "don't block the API" that
// actually works on this deployment target.

const MAX_BATCH_SIZE = 1000;

const bulkItemSchema = z.object({
  conversation_id: z.string().max(200).optional(),
  transcript_text: z.string().min(1).max(50000),
  platform: z.string().max(100).optional(),
  agent_flow: z.string().max(500).optional(),
});

const bulkSchema = z.object({
  conversations: z.array(bulkItemSchema).min(1).max(MAX_BATCH_SIZE),
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

  // A looser limit than the per-conversation ingest routes - this is one
  // call enqueuing up to 1000 conversations, not 1000 calls.
  const rateLimit = await checkRateLimit(`apikey:${keyId}`, "v1-ingest-bulk", 10, 60);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Max 10 bulk-ingest calls per hour for this API key." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const jobRows = parsed.data.conversations.map((c) => ({
    user_id: userId,
    conversation_text: c.transcript_text,
    platform: c.platform ?? null,
    external_conversation_id: c.conversation_id ?? null,
  }));

  const { data, error } = await supabaseAdmin.from("ingest_jobs").insert(jobRows).select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      queued: data.length,
      job_ids: data.map((j) => j.id),
      note: "Processed asynchronously, a batch at a time, by a scheduled job. Poll GET /api/v1/violations or the dashboard to see results as they land.",
    },
    { status: 202 }
  );
}
