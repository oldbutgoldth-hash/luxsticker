"use client";

import type { CompositionPresetId, DecorationDensity, EmotionId, StickerPlanItem } from "@/types";
import { EMOTION_PRESETS } from "@/styles/emotion-presets";
import { COMPOSITION_PRESET_IDS, COMPOSITION_PRESETS } from "@/config/composition-presets";
import { createBlankPlanItem, duplicatePlanItem } from "@/lib/plan-builder";

interface Props {
  plan: StickerPlanItem[];
  onChange: (plan: StickerPlanItem[]) => void;
}

const DENSITY_OPTIONS: DecorationDensity[] = ["none", "low", "normal", "high"];

function renumber(plan: StickerPlanItem[]): StickerPlanItem[] {
  return plan.map((item, i) => ({ ...item, order: i + 1 }));
}

/**
 * Sticker Plan Editor (spec §7) — every row is editable before a single
 * pixel gets rendered. Add/Delete/Duplicate/Move only touch this plain JSON
 * plan array; nothing here calls the render pipeline.
 */
export default function StickerPlanEditor({ plan, onChange }: Props) {
  const update = (index: number, patch: Partial<StickerPlanItem>) => {
    const next = [...plan];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const remove = (index: number) => {
    onChange(renumber(plan.filter((_, i) => i !== index)));
  };

  const duplicate = (index: number) => {
    const next = [...plan];
    next.splice(index + 1, 0, duplicatePlanItem(plan[index], plan[index].order + 1));
    onChange(renumber(next));
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= plan.length) return;
    const next = [...plan];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(renumber(next));
  };

  const add = () => {
    onChange([...plan, createBlankPlanItem(plan.length + 1)]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700">Sticker Plan ({plan.length})</h3>
        <button
          type="button"
          onClick={add}
          className="rounded-full border border-pink-300 px-3 py-1 text-xs font-semibold text-pink-600 hover:bg-pink-50"
        >
          + Add Sticker
        </button>
      </div>

      <div className="max-h-[28rem] space-y-1.5 overflow-y-auto pr-1">
        {plan.map((item, index) => (
          <div key={item.id} className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-2">
            <span className="w-7 shrink-0 text-center text-xs font-bold text-slate-400">{String(item.order).padStart(2, "0")}</span>

            <input
              type="text"
              value={item.text}
              onChange={(e) => update(index, { text: e.target.value })}
              placeholder="ข้อความ..."
              className="min-w-[7rem] flex-1 rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-pink-400"
            />

            <select
              value={item.emotion}
              onChange={(e) => update(index, { emotion: e.target.value as EmotionId })}
              className="rounded-lg border border-slate-200 px-1.5 py-1 text-xs"
              title="Emotion"
            >
              {EMOTION_PRESETS.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.labelTh}
                </option>
              ))}
            </select>

            <select
              value={item.compositionPresetId}
              onChange={(e) => update(index, { compositionPresetId: e.target.value as CompositionPresetId })}
              className="rounded-lg border border-slate-200 px-1.5 py-1 text-xs"
              title="Composition"
            >
              {COMPOSITION_PRESET_IDS.map((id) => (
                <option key={id} value={id}>
                  {COMPOSITION_PRESETS[id].label}
                </option>
              ))}
            </select>

            <select
              value={item.decorationDensity}
              onChange={(e) => update(index, { decorationDensity: e.target.value as DecorationDensity })}
              className="rounded-lg border border-slate-200 px-1.5 py-1 text-xs"
              title="Decoration density"
            >
              {DENSITY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <div className="ml-auto flex items-center gap-0.5">
              <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30">
                ▲
              </button>
              <button type="button" onClick={() => move(index, 1)} disabled={index === plan.length - 1} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30">
                ▼
              </button>
              <button type="button" onClick={() => duplicate(index)} className="rounded p-1 text-xs text-sky-500 hover:bg-sky-50" title="Duplicate">
                ⧉
              </button>
              <button type="button" onClick={() => remove(index)} className="rounded p-1 text-xs text-red-500 hover:bg-red-50" title="Delete">
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
