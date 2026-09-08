import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { extractPolicyFromText } from "@/lib/extraction";
import { checkRateLimit } from "@/lib/rateLimit";

const RATE_LIMIT = 10;
const RATE_LIMIT_WINDOW_MINUTES = 60;

const extractSchema = z.object({
  policy_text: z
    .string()
    .min(1, "Policy text is required.")
    .max(20000, "Policy text must be 20,000 characters or fewer."),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(
    `user:${user.id}`,
    "policy-extract",
    RATE_LIMIT,
    RATE_LIMIT_WINDOW_MINUTES
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Max ${RATE_LIMIT} policy extractions per hour.` },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = extractSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const draft = await extractPolicyFromText(parsed.data.policy_text);
    return NextResponse.json({ draft });
  } catch (err) {
    console.error("Policy extraction failed:", err);
    return NextResponse.json(
      { error: "Failed to extract policy from the document." },
      { status: 502 }
    );
  }
}
