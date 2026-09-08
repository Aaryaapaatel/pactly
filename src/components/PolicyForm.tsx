"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ApprovedOffering, CustomRule, Policy } from "@/types";

export function PolicyForm({ initialPolicy }: { initialPolicy: Policy }) {
  const router = useRouter();
  const [maxDiscount, setMaxDiscount] = useState(initialPolicy.max_discount_percent);
  const [deliveryWeeks, setDeliveryWeeks] = useState(initialPolicy.standard_delivery_weeks);
  const [customRules, setCustomRules] = useState<CustomRule[]>(initialPolicy.custom_rules);
  const [approvedOfferings, setApprovedOfferings] = useState<ApprovedOffering[]>(
    initialPolicy.approved_offerings
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [policyDocText, setPolicyDocText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractSummary, setExtractSummary] = useState<string | null>(null);

  function updateRule(index: number, field: keyof CustomRule, value: string) {
    setCustomRules((prev) =>
      prev.map((rule, i) => (i === index ? { ...rule, [field]: value } : rule))
    );
  }

  function removeRule(index: number) {
    setCustomRules((prev) => prev.filter((_, i) => i !== index));
  }

  function addRule() {
    setCustomRules((prev) => [...prev, { label: "", description: "" }]);
  }

  function updateOffering(index: number, field: keyof ApprovedOffering, value: string) {
    setApprovedOfferings((prev) =>
      prev.map((offering, i) => (i === index ? { ...offering, [field]: value } : offering))
    );
  }

  function removeOffering(index: number) {
    setApprovedOfferings((prev) => prev.filter((_, i) => i !== index));
  }

  function addOffering() {
    setApprovedOfferings((prev) => [...prev, { name: "", description: "" }]);
  }

  async function handleExtract() {
    if (!policyDocText.trim()) return;
    setExtracting(true);
    setExtractError(null);
    setExtractSummary(null);

    try {
      const res = await fetch("/api/policy/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policy_text: policyDocText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to extract policy.");

      const draft = data.draft as {
        max_discount_percent: number | null;
        standard_delivery_weeks: number | null;
        custom_rules: CustomRule[];
        approved_offerings: ApprovedOffering[];
      };

      const found: string[] = [];
      if (draft.max_discount_percent !== null) {
        setMaxDiscount(draft.max_discount_percent);
        found.push("max discount");
      }
      if (draft.standard_delivery_weeks !== null) {
        setDeliveryWeeks(draft.standard_delivery_weeks);
        found.push("delivery timeline");
      }
      if (draft.custom_rules.length > 0) {
        setCustomRules((prev) => [...prev, ...draft.custom_rules]);
        found.push(`${draft.custom_rules.length} custom rule(s)`);
      }
      if (draft.approved_offerings.length > 0) {
        setApprovedOfferings((prev) => [...prev, ...draft.approved_offerings]);
        found.push(`${draft.approved_offerings.length} offering(s)`);
      }

      setExtractSummary(
        found.length > 0
          ? `Found: ${found.join(", ")}. Review below, then save.`
          : "Didn't find any policy rules in that text — nothing was added."
      );
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : "Failed to extract policy.");
    } finally {
      setExtracting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const res = await fetch("/api/policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          max_discount_percent: maxDiscount,
          standard_delivery_weeks: deliveryWeeks,
          custom_rules: customRules.filter((r) => r.label.trim() && r.description.trim()),
          approved_offerings: approvedOfferings.filter(
            (o) => o.name.trim() && o.description.trim()
          ),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save policy.");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save policy.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Company policy</h1>
          <p className="mt-1 text-sm text-slate-500">
            These rules are checked against every promise the AI agent makes.
          </p>
        </div>
        <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">
          ← Back to dashboard
        </Link>
      </div>

      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5">
        <label className="block text-sm font-medium text-slate-700">
          Paste a policy document
        </label>
        <p className="mt-0.5 text-xs text-slate-400">
          Paste an internal handbook excerpt, pricing sheet, or SOP and Claude will pull out the
          discount limit, delivery timeline, rules, and offerings below for you to review.
        </p>
        <textarea
          value={policyDocText}
          onChange={(e) => setPolicyDocText(e.target.value)}
          rows={6}
          placeholder="Paste your policy document here..."
          className="mt-3 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={handleExtract}
            disabled={extracting || !policyDocText.trim()}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {extracting ? "Extracting..." : "Extract with AI"}
          </button>
          {extractSummary && <span className="text-sm text-emerald-600">{extractSummary}</span>}
          {extractError && <span className="text-sm text-red-600">{extractError}</span>}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <label className="block text-sm font-medium text-slate-700">
            Maximum discount (%)
          </label>
          <input
            type="number"
            min={0}
            max={100}
            step="0.1"
            value={maxDiscount}
            onChange={(e) => setMaxDiscount(Number(e.target.value))}
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <label className="block text-sm font-medium text-slate-700">
            Standard delivery timeline (weeks)
          </label>
          <input
            type="number"
            min={0}
            step="0.1"
            value={deliveryWeeks}
            onChange={(e) => setDeliveryWeeks(Number(e.target.value))}
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Approved offerings
              </label>
              <p className="mt-0.5 text-xs text-slate-400">
                What the company actually sells or supports. Any promise for something not on
                this list gets flagged, even if it doesn&apos;t break a numeric rule.
              </p>
            </div>
            <button
              type="button"
              onClick={addOffering}
              className="shrink-0 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              + Add offering
            </button>
          </div>
          {approvedOfferings.length === 0 && (
            <p className="text-sm text-slate-400">
              No offerings list yet. Without one, only the discount, delivery, and custom rules
              below are checked.
            </p>
          )}
          <div className="space-y-3">
            {approvedOfferings.map((offering, i) => (
              <div key={i} className="flex gap-2 rounded-md border border-slate-200 p-3">
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    placeholder="Offering name, e.g. Pro plan"
                    value={offering.name}
                    onChange={(e) => updateOffering(i, "name", e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                  <input
                    type="text"
                    placeholder="Description, e.g. $99/month, includes email support, no SSO"
                    value={offering.description}
                    onChange={(e) => updateOffering(i, "description", e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeOffering(i)}
                  className="self-start text-sm text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <label className="block text-sm font-medium text-slate-700">Custom rules</label>
            <button
              type="button"
              onClick={addRule}
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              + Add rule
            </button>
          </div>
          {customRules.length === 0 && (
            <p className="text-sm text-slate-400">
              No custom rules yet. Add one for anything beyond discount and delivery, e.g.
              &ldquo;No free support&rdquo;.
            </p>
          )}
          <div className="space-y-3">
            {customRules.map((rule, i) => (
              <div key={i} className="flex gap-2 rounded-md border border-slate-200 p-3">
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    placeholder="Rule label, e.g. No free support"
                    value={rule.label}
                    onChange={(e) => updateRule(i, "label", e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                  <input
                    type="text"
                    placeholder="Description, e.g. Agents may not promise free support beyond the 30-day onboarding period"
                    value={rule.description}
                    onChange={(e) => updateRule(i, "description", e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeRule(i)}
                  className="self-start text-sm text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save policy"}
          </button>
          {saved && <span className="text-sm text-emerald-600">Saved.</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </form>
    </div>
  );
}
