"use client";

import type { PackStickerItem } from "@/types";
import { isRealPhotoStyle } from "@/types";

interface Props {
  sticker: PackStickerItem;
  isBusy: boolean;
  onRetry: () => void;
  onUseOriginalCharacter: () => void;
}

/**
 * AI failure banner (spec §17, extended Phase 3.1 §19/§38) — shown on a
 * sticker whose AI generation failed, whether that was an Expression/Pose
 * call (Mode A) or an AI Cartoon Transformation call (Mode B). Exactly the 3
 * options the spec requires: retry just this one sticker's AI call, accept
 * the already-rendered fallback that used the unmodified Character Master
 * cutout, or close this banner and use the normal editor underneath
 * ("Edit Manually" doesn't need its own handler).
 *
 * The fallback button/label is style-aware (spec §19: "ให้สามารถกลับมา Real
 * Photo หรือ Original Character") — for a non-"real" Style (cartoon/kawaii/
 * chibi/comic/hand_drawn), the fallback IS the user's original real photo,
 * so it's labeled "Use Real Photo" instead of the more generic "Use Original
 * Character"; either way it is NEVER labeled or badged as a successful AI
 * result (spec §38/§39: no fake results).
 */
export default function AiFailureBanner({ sticker, isBusy, onRetry, onUseOriginalCharacter }: Props) {
  if (sticker.status !== "needs_ai") return null;
  const style = sticker.project?.style;
  const isCartoonStyle = style ? !isRealPhotoStyle(style) : false;

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
          {isCartoonStyle ? "📷 Use Real Photo" : "Use Original Character"}
        </button>
      </div>
      {isCartoonStyle && (
        <p className="text-[10px] text-red-400">
          AI แปลงเป็นสไตล์ &quot;{style}&quot; ไม่สำเร็จ — สติ๊กเกอร์นี้จะใช้ภาพถ่ายต้นฉบับแทน ไม่ใช่ภาพที่ AI สร้าง
        </p>
      )}
      <p className="text-[10px] text-red-400">
        แก้ไขด้วยตัวเอง: ใช้ตัว Editor ด้านล่างนี้ได้เลย (Edit Manually)
      </p>
    </div>
  );
}
