"use client";

import type { PackStickerItem } from "@/types";

interface Props {
  sticker: PackStickerItem;
  isBusy: boolean;
  onRetry: () => void;
  onUseOriginalCharacter: () => void;
}

/**
 * AI failure banner (spec §17) — shown on a sticker whose AI Expression
 * generation failed. Exactly the 3 options the spec requires: retry just
 * this one sticker's AI call, accept the already-rendered fallback that
 * used the unmodified Character Master ("Original Character Mode" — clearly
 * labeled so it's never mistaken for a successful AI generation), or close
 * this banner and use the normal editor underneath (already visible in the
 * modal — "Edit Manually" doesn't need its own handler).
 */
export default function AiFailureBanner({ sticker, isBusy, onRetry, onUseOriginalCharacter }: Props) {
  if (sticker.status !== "needs_ai") return null;

  return (
    <div className="space-y-2 rounded-xl border-2 border-red-200 bg-red-50 p-3">
      <p className="text-sm font-bold text-red-600">⚠ AI generation failed</p>
      {sticker.aiError && <p className="text-xs text-red-500">{sticker.aiError}</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onRetry}
          disabled={isBusy}
          className="flex-1 rounded-xl bg-red-500 py-2 text-xs font-bold text-white hover:bg-red-600 disabled:opacity-50"
        >
          🔁 Retry
        </button>
        <button
          type="button"
          onClick={onUseOriginalCharacter}
          disabled={isBusy}
          className="flex-1 rounded-xl border border-red-300 py-2 text-xs font-bold text-red-600 hover:bg-red-100 disabled:opacity-50"
        >
          Use Original Character
        </button>
      </div>
      <p className="text-[10px] text-red-400">
        แก้ไขด้วยตัวเอง: ใช้ตัว Editor ด้านล่างนี้ได้เลย (Edit Manually)
      </p>
    </div>
  );
}
