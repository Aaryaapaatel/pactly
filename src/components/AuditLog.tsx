import { CategoryBadge } from "./CategoryBadge";
import { RiskBadge } from "./RiskBadge";
import type { PromiseRecord } from "@/types";

export function AuditLog({ promises }: { promises: PromiseRecord[] }) {
  if (promises.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
        No promises, commitments, or quotes were detected in this conversation.
      </div>
    );
  }

  const riskCount = promises.filter((p) => p.risk_flag).length;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          {promises.length} promise{promises.length === 1 ? "" : "s"} detected
        </h3>
        {riskCount > 0 && (
          <span className="text-sm font-medium text-red-600">
            {riskCount} flagged for policy risk
          </span>
        )}
      </div>
      <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {promises.map((promise) => (
          <li
            key={promise.id}
            className={`p-4 ${promise.risk_flag ? "bg-red-50/40" : ""}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge category={promise.category} />
              <RiskBadge flagged={promise.risk_flag} />
              {promise.extracted_value && (
                <span className="ml-auto rounded-md bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">
                  {promise.extracted_value}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-slate-800">&ldquo;{promise.promise_text}&rdquo;</p>
            {promise.risk_flag && promise.risk_reason && (
              <p className="mt-2 text-sm font-medium text-red-700">⚠ {promise.risk_reason}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
