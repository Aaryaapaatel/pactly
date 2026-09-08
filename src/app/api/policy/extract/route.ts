import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { extractPolicyFromText } from "@/lib/extraction";

const extractSchema = z.object({
  policy_text: z.string().min(1, "Policy text is required."),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
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
