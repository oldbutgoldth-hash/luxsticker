"use client";

import type { ValidationResult } from "@/types";

/** Itemized per-check breakdown — embedded inside ExportStatusCard. Kept as
 * its own component so the detail list can be reused anywhere validation
 * results need to be shown. */
export default function ValidationChecklist({ result }: { result: ValidationResult }) {
  const items = result.checks.filter((c) => c.id !== "final-readiness");
  return (
    <ul className="space-y-1.5">
      {items.map((c) => (
        <li key={c.id} className="flex items-start gap-2 text-xs text-slate-600">
          <span className={c.passed ? "text-emerald-500" : "text-red-500"}>{c.passed ? "✓" : "✗"}</span>
          <span>
            <span className="font-medium text-slate-700">{c.label}:</span> {c.message}
            {c.autoFixed && <span className="ml-1 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-600">แก้ไขอัตโนมัติแล้ว</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
