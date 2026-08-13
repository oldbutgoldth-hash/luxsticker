"use client";

import type { EmotionId } from "@/types";
import { EMOTION_PRESETS } from "@/styles/emotion-presets";

interface Props {
  value: EmotionId;
  customText: string;
  onChangeEmotion: (id: EmotionId) => void;
  onChangeCustomText: (text: string) => void;
}

export default function EmotionPicker({ value, customText, onChangeEmotion, onChangeCustomText }: Props) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-700">อารมณ์ / ข้อความ</h3>
      <div className="flex flex-wrap gap-2">
        {EMOTION_PRESETS.filter((e) => e.id !== "custom").map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => onChangeEmotion(e.id)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              value === e.id
                ? "border-pink-500 bg-pink-500 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            {e.labelTh}
          </button>
        ))}
      </div>

      <div className="mt-3">
        <label className="mb-1 block text-xs font-medium text-slate-500">Custom Text (พิมพ์ข้อความเอง)</label>
        <input
          type="text"
          value={customText}
          onChange={(e) => {
            onChangeCustomText(e.target.value);
            if (e.target.value.trim()) onChangeEmotion("custom");
          }}
          placeholder="พิมพ์ข้อความของคุณเอง..."
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-pink-400"
        />
      </div>
    </div>
  );
}
