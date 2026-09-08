import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveApiKey } from "@/lib/apiKeyAuth";
import { checkRateLimit } from "@/lib/rateLimit";
import { getActivePolicy } from "@/lib/policy";
import { parsePercent, parseWeeks } from "@/lib/extraction";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Synchronous real-time blocking check, meant to run inline before an agent
// sends a draft response. Deliberately deterministic-only, no Claude call:
// an LLM round-trip realistically takes well over a second, which cannot
// meet a <300ms p95 target. This catches numeric discount/timeline
// over-promises only - not nuanced feature/offering violations, which still
// need the full async extraction pipeline (POST /api/ingest). Fail-open:
// any internal error or timeout returns block:false rather than blocking
// a legitimate response because Pactly itself had a problem.

const TIMEOUT_MS = 280;

const checkSchema = z.object({
  draft_response_text: z.string().min(1).max(5000),
});

interface CheckResult {
  block: boolean;
  reason: string | null;
  suggested_fix: string | null;
}

async function runCheck(userId: string, text: string): Promise<CheckResult> {
  const policy = await getActivePolicy(supabaseAdmin, userId);

  const percent = parsePercent(text);
  if (percent !== null && percent > policy.max_discount_percent) {
    return {
      block: true,
      reason: `Discount of ${percent}% exceeds the maximum allowed discount of ${policy.max_discount_percent}%.`,
      suggested_fix: `Offer at most ${policy.max_discount_percent}% instead.`,
    };
  }

  const weeks = parseWeeks(text);
  if (weeks !== null && weeks > policy.standard_delivery_weeks) {
    return {
      block: true,
      reason: `Promised timeline exceeds the standard delivery window of ${policy.standard_delivery_weeks} weeks.`,
      suggested_fix: `Quote ${policy.standard_delivery_weeks} weeks or the standard delivery language instead.`,
    };
  }

  return { block: false, reason: null, suggested_fix: null };
}

export async function POST(request: Request) {
  const resolved = await resolveApiKey(request);
  if (!resolved) {
    return NextResponse.json(
      { error: "Missing or invalid API key. Send it as 'Authorization: Bearer <key>'." },
      { status: 401 }
    );
  }
  const { keyId, userId } = resolved;

  const rateLimit = await checkRateLimit(`apikey:${keyId}`, "v1-check", 3000, 60);
  if (!rateLimit.allowed) {
    // Fail-open even on rate limit - a blocking-check endpoint should never
    // become the reason a real conversation stalls.
    return NextResponse.json({ block: false, reason: null, suggested_fix: null });
  }

  const body = await request.json().catch(() => null);
  const parsed = checkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const timeout = new Promise<CheckResult>((resolve) =>
      setTimeout(() => resolve({ block: false, reason: null, suggested_fix: null }), TIMEOUT_MS)
    );
    const result = await Promise.race([runCheck(userId, parsed.data.draft_response_text), timeout]);
    return NextResponse.json(result);
  } catch (err) {
    console.error("v1/check failed, failing open:", err);
    return NextResponse.json({ block: false, reason: null, suggested_fix: null });
  }
}
