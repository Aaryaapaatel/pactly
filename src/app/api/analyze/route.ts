import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { checkUsageAllowed } from "@/lib/subscription";
import { runIngestPipeline, ExtractionFailedError } from "@/lib/ingestPipeline";

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

  const usage = await checkUsageAllowed(supabase, user.id);
  if (!usage.allowed) {
    return NextResponse.json(
      {
        error: `You've used all ${usage.limit} free conversations this month. Upgrade to Pro for unlimited.`,
        upgrade_url: "/pricing",
      },
      { status: 402 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = analyzeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const conversation = await runIngestPipeline(supabase, user.id, parsed.data.conversation_text, {
      title: parsed.data.title,
      platform: "manual",
    });
    return NextResponse.json({ conversation });
  } catch (err) {
    if (err instanceof ExtractionFailedError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    console.error("Analyze failed:", err);
    return NextResponse.json({ error: "Failed to analyze conversation." }, { status: 500 });
  }
}
