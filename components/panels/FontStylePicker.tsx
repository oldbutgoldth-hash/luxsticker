"use client";

import type { FontStyleId } from "@/types";
import { FONT_CATALOG, FONT_STYLE_ORDER } from "@/config/font-catalog";

interface Props {
  value: FontStyleId;
  onChange: (font: FontStyleId) => void;
  /** Spec §23 "Font Lock" — when true, every sticker uses the pack's own
   * `fontStyle`; this component still renders (so the user can see/change
   * the locked value itself), it's per-item override controls elsewhere
   * that get hidden when locked, not this picker. */
  disabled?: boolean;
}

/**
 * Typography category picker (Phase 3.1 spec §10/§11) — the user picks a
 * *category* ("น่ารัก", "คาวาอี้", ...), never a raw font file. "Auto" lets
 * the Typography Engine match a font per sticker's Emotion (spec §12).
 * Each card previews itself in its own real font (self-generated, not a
 * copied reference image) so the choice is visually obvious before picking.
 */
export default function FontStylePicker({ value, onChange, disabled }: Props) {
  return (
    <div className={disabled ? "pointer-events-none opacity-50" : undefined}>
      <h3 className="mb-2 text-sm font-semibold text-slate-700">Font (Typography)</h3>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        <button
          type="button"
          onClick={() => onChange("auto")}
          className={`flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-3 text-center transition-all ${
            value === "auto" ? "border-pink-500 bg-pink-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"
          }`}
        >
          <span className="text-lg">✨</span>
          <span className="text-[11px] font-semibold text-slate-700">Auto</span>
        </button>
        {FONT_STYLE_ORDER.map((id) => {
          const entry = FONT_CATALOG[id];
          const active = value === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-3 text-center transition-all ${
                active ? "border-pink-500 bg-pink-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <span className="text-base" style={{ fontFamily: entry.fontFamily, fontWeight: entry.fontWeight }}>
                Aa ก
              </span>
              <span className="text-[11px] font-semibold text-slate-700">{entry.labelTh}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
