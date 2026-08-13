"use client";

import type { PackValidationSummary } from "@/lib/pack-validation";

/** Pack Summary (spec §19) — N/Total Ready plus which of the 8 quality
 * checks are failing and on which sticker numbers. */
export default function PackSummaryBar({ summary }: { summary: PackValidationSummary }) {
  const allReady = summary.total > 0 && summary.readyCount === summary.total;
  return (
    <div className={`w-full rounded-2xl border-2 p-4 ${allReady ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700">Sticker Pack</h3>
        <span className={`text-sm font-extrabold ${allReady ? "text-emerald-600" : "text-amber-600"}`}>
          {summary.readyCount} / {summary.total} Ready
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
        {summary.aggregateChecks.map((c) => (
          <div key={c.id} className="flex items-center gap-1.5 text-xs">
            <span className={c.allPassed ? "text-emerald-500" : "text-red-500"}>{c.allPassed ? "✓" : "✗"}</span>
            <span className="text-slate-600">{c.label}</span>
            {!c.allPassed && <span className="text-[10px] text-red-400">({c.failingOrders.length})</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
