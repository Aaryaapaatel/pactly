export function RiskBadge({ flagged }: { flagged: boolean }) {
  if (!flagged) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-500/10">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        Compliant
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
      Policy risk
    </span>
  );
}
