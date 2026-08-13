"use client";

import type { OutlineConfig, OutlineStyle } from "@/types";

const OUTLINE_OPTIONS: { id: OutlineStyle; label: string }[] = [
  { id: "white", label: "White" },
  { id: "black", label: "Black" },
  { id: "soft-white", label: "Soft White" },
  { id: "thick", label: "Thick" },
  { id: "double", label: "Double" },
];

interface Props {
  value: OutlineConfig;
  onChange: (config: OutlineConfig) => void;
}

export default function OutlinePanel({ value, onChange }: Props) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-700">Sticker Outline</h3>
      <div className="flex flex-wrap gap-2">
        {OUTLINE_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange({ ...value, style: opt.id })}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              value.style === opt.id
                ? "border-pink-500 bg-pink-500 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <label className="text-xs font-medium text-slate-500">Width</label>
        <input
          type="range"
          min={4}
          max={40}
          value={value.widthPx}
          onChange={(e) => onChange({ ...value, widthPx: Number(e.target.value) })}
          className="flex-1"
        />
        <span className="w-10 text-right text-xs text-slate-500">{value.widthPx}px</span>
      </div>
    </div>
  );
}
