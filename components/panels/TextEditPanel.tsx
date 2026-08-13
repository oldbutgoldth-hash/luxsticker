"use client";

import type { TextLayer } from "@/types";
import { FONT_CHOICES } from "@/lib/fonts";

interface Props {
  layer: TextLayer;
  onChange: (patch: Partial<TextLayer>) => void;
}

const WEIGHTS = [400, 500, 600, 700, 800];

export default function TextEditPanel({ layer, onChange }: Props) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Text</h4>

      <textarea
        value={layer.text}
        onChange={(e) => onChange({ text: e.target.value })}
        rows={2}
        className="w-full resize-none rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-pink-400"
      />

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-slate-500">
          Font
          <select
            value={layer.fontFamily}
            onChange={(e) => onChange({ fontFamily: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          >
            {FONT_CHOICES.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-slate-500">
          Weight
          <select
            value={layer.fontWeight}
            onChange={(e) => onChange({ fontWeight: Number(e.target.value) })}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          >
            {WEIGHTS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-xs text-slate-500">
        Size ({layer.fontSizePx}px)
        <input
          type="range"
          min={40}
          max={260}
          value={layer.fontSizePx}
          onChange={(e) => onChange({ fontSizePx: Number(e.target.value) })}
          className="mt-1 w-full"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-slate-500">
          Color
          <input
            type="color"
            value={layer.color}
            onChange={(e) => onChange({ color: e.target.value })}
            className="mt-1 h-8 w-full rounded-lg border border-slate-200"
          />
        </label>
        <label className="text-xs text-slate-500">
          Outline color
          <input
            type="color"
            value={layer.outlineColor}
            onChange={(e) => onChange({ outlineColor: e.target.value })}
            className="mt-1 h-8 w-full rounded-lg border border-slate-200"
          />
        </label>
      </div>

      <label className="block text-xs text-slate-500">
        Outline width ({layer.outlineWidthPx}px)
        <input
          type="range"
          min={0}
          max={24}
          value={layer.outlineWidthPx}
          onChange={(e) => onChange({ outlineWidthPx: Number(e.target.value) })}
          className="mt-1 w-full"
        />
      </label>

      <label className="block text-xs text-slate-500">
        Rotation
        <input
          type="range"
          min={-45}
          max={45}
          value={Math.round((layer.rotation * 180) / Math.PI)}
          onChange={(e) => onChange({ rotation: (Number(e.target.value) * Math.PI) / 180 })}
          className="mt-1 w-full"
        />
      </label>

      <label className="flex items-center gap-2 text-xs text-slate-500">
        <input type="checkbox" checked={layer.shadow} onChange={(e) => onChange({ shadow: e.target.checked })} />
        Shadow
      </label>
    </div>
  );
}
