import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", id)
    .single();

  if (conversationError) {
    return NextResponse.json({ error: conversationError.message }, { status: 404 });
  }

  const { data: promises, error: promisesError } = await supabase
    .from("promises")
    .select("*")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (promisesError) {
    return NextResponse.json({ error: promisesError.message }, { status: 500 });
  }

  return NextResponse.json({ conversation: { ...conversation, promises } });
}
