"use client";

import type { StyleId } from "@/types";
import { STYLE_ORDER, STYLE_PRESETS } from "@/styles/style-presets";

interface Props {
  value: StyleId;
  onChange: (style: StyleId) => void;
}

export default function StylePicker({ value, onChange }: Props) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-700">Style</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STYLE_ORDER.map((id) => {
          const preset = STYLE_PRESETS[id];
          const active = value === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              style={{ backgroundColor: active ? preset.swatch : undefined }}
              className={`flex flex-col items-center gap-1 rounded-xl border-2 px-3 py-3 text-center transition-all ${
                active ? "border-pink-500 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <span className="text-2xl">{preset.emoji}</span>
              <span className="text-xs font-semibold text-slate-700">{preset.labelTh}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
