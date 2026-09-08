import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSubscription } from "@/lib/subscription";
import { PricingCard } from "@/components/PricingCard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pricing | Pactly",
  description: "Simple pricing for Pactly: audit AI sales agent conversations against your company policy.",
};

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const subscription = user ? await getSubscription(supabase, user.id) : null;
  const isPro = subscription?.plan === "pro" && subscription.status === "active";

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-10 text-center">
        <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">
          ← Back
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-slate-900">Pricing</h1>
        <p className="mt-2 text-slate-500">Simple, straightforward, no surprises.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900">Free</h2>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            $0<span className="text-base font-normal text-slate-500">/month</span>
          </p>
          <ul className="mt-6 space-y-2 text-sm text-slate-600">
            <li>20 conversations audited per month</li>
            <li>Full policy checks and risk flags</li>
            <li>1 user</li>
          </ul>
          <Link
            href={user ? "/dashboard" : "/login"}
            className="mt-6 block rounded-md border border-slate-300 bg-white px-4 py-2 text-center text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            {user ? "Go to dashboard" : "Get started"}
          </Link>
        </div>

        <div className="rounded-lg border-2 border-slate-900 p-6">
          <h2 className="font-semibold text-slate-900">Pro</h2>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            $49<span className="text-base font-normal text-slate-500">/month</span>
          </p>
          <ul className="mt-6 space-y-2 text-sm text-slate-600">
            <li>Unlimited conversations</li>
            <li>Automatic ingestion via API</li>
            <li>CSV export</li>
            <li>Priority support</li>
          </ul>
          {isPro ? (
            <span className="mt-6 block rounded-md bg-emerald-50 px-4 py-2 text-center text-sm font-semibold text-emerald-700">
              Current plan
            </span>
          ) : (
            <PricingCard isLoggedIn={Boolean(user)} />
          )}
        </div>
      </div>
    </div>
  );
}
