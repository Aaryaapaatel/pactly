import { PolicyForm } from "@/components/PolicyForm";
import { getActivePolicy } from "@/lib/policy";

export const dynamic = "force-dynamic";

export default async function PolicyPage() {
  const policy = await getActivePolicy();
  return <PolicyForm initialPolicy={policy} />;
}
