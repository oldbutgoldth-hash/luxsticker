"use client";

import type { PackPresetId } from "@/types";
import { PACK_PRESET_ORDER, PACK_PRESETS } from "@/config/pack-presets";

interface Props {
  value: PackPresetId;
  onChange: (preset: PackPresetId) => void;
}

const PRESET_EMOJI: Record<PackPresetId, string> = {
  daily: "☀️",
  love: "❤️",
  funny: "😂",
  work: "💼",
  cute: "🧸",
  travel: "✈️",
  custom: "🎛️",
};

export default function PackPresetPicker({ value, onChange }: Props) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-700">Choose Pack Preset</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {PACK_PRESET_ORDER.map((id) => {
          const active = value === id;
          const label = id === "custom" ? "กำหนดเอง" : PACK_PRESETS[id].labelTh;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`flex flex-col items-center gap-1 rounded-xl border-2 px-3 py-3 text-center transition-colors ${
                active ? "border-pink-500 bg-pink-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <span className="text-2xl">{PRESET_EMOJI[id]}</span>
              <span className="text-xs font-semibold text-slate-700">{label}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-slate-400">
        ใช้ Template คำพูดสำเร็จรูป + Graphic Composition อัตโนมัติ (ยังไม่ใช่ AI สร้างท่าทางใหม่)
      </p>
    </div>
  );
}
