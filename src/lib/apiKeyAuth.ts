import "server-only";
import { supabaseAdmin } from "./supabase/admin";
import { hashApiKey } from "./apiKeys";

export interface ResolvedApiKey {
  keyId: string;
  userId: string;
}

// Shared by every API-key-authenticated route (/api/ingest, /api/v1/ingest,
// /api/v1/check, the platform webhooks). Reads the Authorization header,
// hashes it, and looks it up - never trusts anything else in the request
// to say who the caller is.
export async function resolveApiKey(request: Request): Promise<ResolvedApiKey | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  const apiKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!apiKey) return null;

  const keyHash = hashApiKey(apiKey);
  const { data: keyRow, error } = await supabaseAdmin
    .from("api_keys")
    .select("id, user_id")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (error || !keyRow) return null;

  // Awaited, not fire-and-forget: a serverless function can freeze
  // immediately after the response is sent, so an un-awaited write here
  // isn't reliably durable.
  await supabaseAdmin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRow.id);

  return { keyId: keyRow.id as string, userId: keyRow.user_id as string };
}
