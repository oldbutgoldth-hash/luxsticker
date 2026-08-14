"use client";

import type { ColorThemeId } from "@/types";
import { COLOR_THEMES, COLOR_THEME_ORDER } from "@/config/color-themes";

interface Props {
  value: ColorThemeId;
  onChange: (theme: ColorThemeId) => void;
}

/** Color theme picker (Phase 3.1 spec §26). "Auto" resolves per sticker
 * from that sticker's Emotion + the pack's Style (config/color-themes.ts). */
export default function ColorThemePicker({ value, onChange }: Props) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-700">Color Theme</h3>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange("auto")}
          className={`flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-xs font-semibold transition-all ${
            value === "auto" ? "border-pink-500 bg-pink-50 text-pink-600" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
          }`}
        >
          ✨ Auto
        </button>
        {COLOR_THEME_ORDER.map((id) => {
          const theme = COLOR_THEMES[id];
          const active = value === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-xs font-semibold transition-all ${
                active ? "border-pink-500 bg-pink-50 text-pink-600" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              <span
                className="h-3.5 w-3.5 rounded-full border border-black/10"
                style={{ background: theme.swatch }}
                aria-hidden
              />
              {theme.labelTh}
            </button>
          );
        })}
      </div>
    </div>
  );
}
