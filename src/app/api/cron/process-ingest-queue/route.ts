import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { runIngestPipeline, ExtractionFailedError } from "@/lib/ingestPipeline";

// Triggered by Vercel Cron (see vercel.json) - not meant to be called by
// end users, so it's protected by a shared secret rather than a user
// session or API key.
const BATCH_SIZE = 20;

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: jobs, error } = await supabaseAdmin
    .from("ingest_jobs")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let processed = 0;
  let failed = 0;

  for (const job of jobs ?? []) {
    await supabaseAdmin.from("ingest_jobs").update({ status: "processing" }).eq("id", job.id);

    try {
      await runIngestPipeline(supabaseAdmin, job.user_id, job.conversation_text, {
        platform: job.platform,
        externalConversationId: job.external_conversation_id,
      });
      await supabaseAdmin
        .from("ingest_jobs")
        .update({ status: "done", processed_at: new Date().toISOString() })
        .eq("id", job.id);
      processed++;
    } catch (err) {
      const message = err instanceof ExtractionFailedError ? err.message : "Ingest failed.";
      await supabaseAdmin
        .from("ingest_jobs")
        .update({ status: "failed", error: message, processed_at: new Date().toISOString() })
        .eq("id", job.id);
      console.error(`ingest_jobs ${job.id} failed:`, err);
      failed++;
    }
  }

  return NextResponse.json({ processed, failed, remaining_in_batch: (jobs ?? []).length - processed - failed });
}
