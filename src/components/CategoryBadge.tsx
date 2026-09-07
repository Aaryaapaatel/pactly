import type { PromiseCategory } from "@/types";

const STYLES: Record<PromiseCategory, string> = {
  pricing: "bg-blue-50 text-blue-700 ring-blue-600/20",
  discount: "bg-purple-50 text-purple-700 ring-purple-600/20",
  timeline: "bg-amber-50 text-amber-700 ring-amber-600/20",
  feature: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  other: "bg-slate-100 text-slate-700 ring-slate-600/20",
};

export function CategoryBadge({ category }: { category: PromiseCategory }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[category]}`}
    >
      {category}
    </span>
  );
}
