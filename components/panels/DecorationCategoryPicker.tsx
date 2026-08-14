"use client";

import type { DecorationCategoryId } from "@/types";
import { DECORATION_CATEGORIES, DECORATION_CATEGORY_ORDER } from "@/config/decoration-categories";

interface Props {
  value: DecorationCategoryId;
  onChange: (category: DecorationCategoryId) => void;
}

/** Decoration category picker (Phase 3.1 spec §16/§30). "Auto" resolves per
 * sticker from that sticker's Emotion (config/decoration-categories.ts). */
export default function DecorationCategoryPicker({ value, onChange }: Props) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-700">Decoration</h3>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange("auto")}
          className={`rounded-full border-2 px-3 py-1.5 text-xs font-semibold transition-all ${
            value === "auto" ? "border-pink-500 bg-pink-50 text-pink-600" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
          }`}
        >
          ✨ Auto
        </button>
        {DECORATION_CATEGORY_ORDER.map((id) => {
          const cat = DECORATION_CATEGORIES[id];
          const active = value === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`rounded-full border-2 px-3 py-1.5 text-xs font-semibold transition-all ${
                active ? "border-pink-500 bg-pink-50 text-pink-600" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {cat.glyphs[0]} {cat.labelTh}
            </button>
          );
        })}
      </div>
    </div>
  );
}
