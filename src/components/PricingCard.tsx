"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PricingCard({ isLoggedIn }: { isLoggedIn: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade() {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start checkout.");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start checkout.");
      setLoading(false);
    }
  }

  return (
    <div className="mt-6">
      <button
        onClick={handleUpgrade}
        disabled={loading}
        className="block w-full rounded-md bg-slate-900 px-4 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-slate-700 disabled:opacity-50"
      >
        {loading ? "Redirecting..." : isLoggedIn ? "Upgrade to Pro" : "Sign up for Pro"}
      </button>
      {error && <p className="mt-2 text-center text-sm text-red-600">{error}</p>}
    </div>
  );
}
