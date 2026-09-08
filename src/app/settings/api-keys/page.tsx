import { redirect } from "next/navigation";
import { ApiKeysManager } from "@/components/ApiKeysManager";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ApiKeysPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, created_at, last_used_at")
    .order("created_at", { ascending: false });

  return <ApiKeysManager initialKeys={data ?? []} />;
}
