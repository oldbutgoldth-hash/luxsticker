"use client";

interface Props {
  done: number;
  total: number;
  stage: string;
}

/** Batch Generation queue progress (spec §15). */
export default function PackProgress({ done, total, stage }: Props) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-700">
        <span>Generating Sticker Pack</span>
        <span>
          {done} / {total}
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-pink-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-400">{stage}</p>
    </div>
  );
}
