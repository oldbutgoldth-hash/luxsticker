"use client";

import { useState } from "react";
import type { PackStickerItem, StickerProject } from "@/types";
import StickerCanvasEditor from "@/components/sticker-editor/StickerCanvasEditor";
import EditorToolbar from "@/components/sticker-editor/EditorToolbar";
import FinalPreviewCanvas from "@/components/sticker-editor/FinalPreviewCanvas";
import AiFailureBanner from "./AiFailureBanner";

interface Props {
  sticker: PackStickerItem;
  isBusy: boolean;
  onClose: () => void;
  onProjectChange: (project: StickerProject) => void;
  onRegenerate: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  /** Phase 2.5 — only relevant when `sticker.status === "needs_ai"`. */
  onAiRetry?: () => void;
  onUseOriginalCharacter?: () => void;
}

/**
 * Individual sticker edit (spec §20) — reuses the exact same
 * StickerCanvasEditor / EditorToolbar the single-sticker flow uses (Phase 1,
 * untouched). Save happens implicitly through the same debounced
 * onProjectChange -> refreshAfterEdit path the single-sticker editor already
 * has; this modal just also exposes Regenerate/Duplicate/Delete for this one
 * sticker (spec §21/§22 — never the whole pack).
 */
export default function PackStickerEditorModal({
  sticker,
  isBusy,
  onClose,
  onProjectChange,
  onRegenerate,
  onDuplicate,
  onDelete,
  onAiRetry,
  onUseOriginalCharacter,
}: Props) {
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.85);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div>
            <h3 className="text-sm font-bold text-slate-700">
              แก้ไข Sticker #{String(sticker.order).padStart(2, "0")} — {sticker.project?.text?.text}
            </h3>
            {sticker.characterMode === "original_character" && sticker.aiStatus && (
              <p className="text-[10px] font-semibold text-amber-600">Original Character Mode (ไม่ได้ใช้ AI Expression)</p>
            )}
            {sticker.aiMetadata?.mock && (
              <p className="text-[10px] font-semibold text-red-500">MOCK — NO AI</p>
            )}
          </div>
          <button onClick={onClose} className="rounded-full px-3 py-1 text-sm text-slate-400 hover:bg-slate-100">
            ✕ ปิด
          </button>
        </div>

        <div className="grid flex-1 gap-4 overflow-y-auto p-5 md:grid-cols-[2fr_1fr]">
          {sticker.status === "needs_ai" && (
            <div className="md:col-span-2">
              <AiFailureBanner
                sticker={sticker}
                isBusy={isBusy}
                onRetry={() => onAiRetry?.()}
                onUseOriginalCharacter={() => onUseOriginalCharacter?.()}
              />
            </div>
          )}
          {sticker.project ? (
            <StickerCanvasEditor
              project={sticker.project}
              editable
              zoom={zoom}
              selectedLayerId={selectedLayerId}
              onSelectLayer={setSelectedLayerId}
              onCommit={onProjectChange}
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-red-300 bg-red-50 p-10 text-center">
              <p className="text-sm font-semibold text-red-600">สติ๊กเกอร์นี้ยังสร้างไม่สำเร็จ</p>
              <FinalPreviewCanvas source={null} />
            </div>
          )}

          <div className="space-y-4">
            {sticker.project && (
              <EditorToolbar
                project={sticker.project}
                zoom={zoom}
                onZoomChange={setZoom}
                selectedLayerId={selectedLayerId}
                onSelectLayer={setSelectedLayerId}
                onProjectChange={onProjectChange}
              />
            )}

            <div className="space-y-2 rounded-xl border border-slate-200 p-3">
              <button
                type="button"
                onClick={onRegenerate}
                disabled={isBusy}
                className="w-full rounded-xl border border-slate-300 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                🔁 Regenerate (สติ๊กเกอร์นี้เท่านั้น)
              </button>
              <button
                type="button"
                onClick={onDuplicate}
                disabled={isBusy}
                className="w-full rounded-xl border border-slate-300 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                ⧉ Duplicate
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={isBusy}
                className="w-full rounded-xl border border-red-200 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 disabled:opacity-50"
              >
                ✕ Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
