import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Browser client used only for auth (sign in / sign up / sign out). All data
// reads/writes happen server-side via src/lib/supabase/server.ts.
export function createClient() {
  return createBrowserClient(supabaseUrl, anonKey);
}
