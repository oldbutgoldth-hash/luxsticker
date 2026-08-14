"use client";

import type { ValidationResult } from "@/types";

export default function ValidationChecklist({ result }: { result: ValidationResult }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className={`mb-2 text-sm font-bold ${result.passed ? "text-emerald-600" : "text-amber-600"}`}>
        {result.passed ? "✓ READY TO USE" : "⚠ พบข้อควรตรวจสอบ"}
      </div>
      <ul className="space-y-1">
        {result.checks.map((c) => (
          <li key={c.id} className="flex items-start gap-2 text-xs text-slate-600">
            <span className={c.passed ? "text-emerald-500" : "text-amber-500"}>{c.passed ? "✓" : "!"}</span>
            <span>
              <span className="font-medium text-slate-700">{c.label}:</span> {c.message}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
