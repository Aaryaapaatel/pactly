import { redirect } from "next/navigation";
import { Dashboard } from "@/components/Dashboard";
import { getActivePolicy } from "@/lib/policy";
import { checkUsageAllowed, getSubscription } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";
import type { PromiseCategory } from "@/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const policy = await getActivePolicy(supabase, user.id);
  const subscription = await getSubscription(supabase, user.id);
  const usage = await checkUsageAllowed(supabase, user.id);

  const { data } = await supabase
    .from("conversations")
    .select("id, title, raw_text, created_at, promises(id, risk_flag, category)")
    .order("created_at", { ascending: false })
    .limit(50);

  const conversations = (data ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    raw_text: c.raw_text,
    created_at: c.created_at,
    promise_count: c.promises.length,
    risk_count: c.promises.filter((p: { risk_flag: boolean }) => p.risk_flag).length,
    categories: Array.from(
      new Set(c.promises.map((p: { category: PromiseCategory }) => p.category))
    ),
  }));

  return (
    <Dashboard
      initialPolicy={policy}
      initialConversations={conversations}
      userEmail={user.email ?? ""}
      plan={subscription.plan}
      conversationsUsed={usage.used}
      conversationsLimit={usage.limit}
    />
  );
}
