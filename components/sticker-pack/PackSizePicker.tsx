"use client";

import type { PackSize } from "@/types";
import { PACK_SIZES } from "@/types";

interface Props {
  value: PackSize;
  onChange: (size: PackSize) => void;
}

export default function PackSizePicker({ value, onChange }: Props) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-700">Choose Sticker Pack Size</h3>
      <div className="grid grid-cols-5 gap-2">
        {PACK_SIZES.map((size) => (
          <button
            key={size}
            type="button"
            onClick={() => onChange(size)}
            className={`rounded-xl border-2 py-3 text-center text-sm font-bold transition-colors ${
              value === size
                ? "border-pink-500 bg-pink-500 text-white shadow-sm"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            {size}
          </button>
        ))}
      </div>
    </div>
  );
}
