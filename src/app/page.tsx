import { Dashboard } from "@/components/Dashboard";
import { getActivePolicy } from "@/lib/policy";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function Home() {
  const policy = await getActivePolicy();

  const { data } = await supabase
    .from("conversations")
    .select("id, title, raw_text, created_at, promises(id, risk_flag)")
    .order("created_at", { ascending: false })
    .limit(50);

  const conversations = (data ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    raw_text: c.raw_text,
    created_at: c.created_at,
    promise_count: c.promises.length,
    risk_count: c.promises.filter((p: { risk_flag: boolean }) => p.risk_flag).length,
  }));

  return <Dashboard initialPolicy={policy} initialConversations={conversations} />;
}
