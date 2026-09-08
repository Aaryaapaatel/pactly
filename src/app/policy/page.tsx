import { redirect } from "next/navigation";
import { PolicyForm } from "@/components/PolicyForm";
import { getActivePolicy } from "@/lib/policy";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PolicyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const policy = await getActivePolicy(supabase, user.id);
  return <PolicyForm initialPolicy={policy} />;
}
