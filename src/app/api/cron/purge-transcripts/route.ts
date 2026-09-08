import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Zero-retention for raw transcripts: 24 hours after a conversation is
// created, its raw_text is wiped. The conversation row, its extracted
// promises, and any risk flags all stay - only the original transcript
// content is deleted. Triggered by Vercel Cron (see vercel.json), protected
// by a shared secret since it's not meant to be called by end users.
const RETENTION_HOURS = 24;

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - RETENTION_HOURS * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("conversations")
    .update({ raw_text: null, transcript_purged_at: new Date().toISOString() })
    .lt("created_at", cutoff)
    .is("transcript_purged_at", null)
    .not("raw_text", "is", null)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ purged: data.length });
}
