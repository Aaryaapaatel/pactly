import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, raw_text, created_at, promises(id, risk_flag)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const conversations = data.map((c) => ({
    id: c.id,
    title: c.title,
    raw_text: c.raw_text,
    created_at: c.created_at,
    promise_count: c.promises.length,
    risk_count: c.promises.filter((p: { risk_flag: boolean }) => p.risk_flag).length,
  }));

  return NextResponse.json({ conversations });
}
