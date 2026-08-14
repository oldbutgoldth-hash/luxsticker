"use client";

import { useEffect, useRef } from "react";
import type { PackStickerItem } from "@/types";

function CardPreview({ canvas }: { canvas: HTMLCanvasElement | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !canvas) return;
    el.width = canvas.width;
    el.height = canvas.height;
    const ctx = el.getContext("2d")!;
    ctx.clearRect(0, 0, el.width, el.height);
    ctx.drawImage(canvas, 0, 0);
  }, [canvas]);

  if (!canvas) {
    return <div className="flex h-full w-full items-center justify-center text-2xl text-slate-300">…</div>;
  }
  return (
    <div className="checkerboard h-full w-full" style={{ aspectRatio: `${canvas.width} / ${canvas.height}` }}>
      <canvas ref={ref} className="h-full w-full object-contain" />
    </div>
  );
}

const STATUS_BADGE: Record<PackStickerItem["status"], { label: string; className: string }> = {
  pending: { label: "…", className: "bg-slate-100 text-slate-500" },
  generating: { label: "กำลังสร้าง", className: "bg-sky-100 text-sky-600" },
  ready: { label: "✓ READY", className: "bg-emerald-100 text-emerald-600" },
  needs_fix: { label: "⚠ NEEDS FIX", className: "bg-amber-100 text-amber-700" },
  error: { label: "✗ ERROR", className: "bg-red-100 text-red-600" },
  needs_ai: { label: "⚠ AI FAILED", className: "bg-red-100 text-red-600" },
};

/** Spec §22 — per-sticker AI status shown alongside the geometry/validation
 * status badge above, only when this sticker actually went through the AI
 * Expression Engine (`aiStatus` is undefined for plain Phase 2 stickers). */
const AI_STATUS_BADGE: Record<NonNullable<PackStickerItem["aiStatus"]>, { label: string; className: string }> = {
  AI_PENDING: { label: "⏳ AI PENDING", className: "bg-slate-100 text-slate-500" },
  AI_GENERATING: { label: "⏳ AI GENERATING", className: "bg-sky-100 text-sky-600" },
  AI_READY: { label: "✓ AI READY", className: "bg-violet-100 text-violet-600" },
  AI_FAILED: { label: "⚠ AI FAILED", className: "bg-red-100 text-red-600" },
};

interface Props {
  stickers: PackStickerItem[];
  onSelect: (sticker: PackStickerItem) => void;
}

/** Pack Dashboard grid (spec §18) — responsive per §38 (2 cols mobile, 3
 * tablet, 4-5 desktop). Clicking any card opens the shared sticker editor. */
export default function PackDashboardGrid({ stickers, onSelect }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {stickers
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((sticker) => {
          const badge = STATUS_BADGE[sticker.status];
          return (
            <button
              key={sticker.id}
              type="button"
              onClick={() => onSelect(sticker)}
              className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="relative aspect-square w-full overflow-hidden bg-slate-50">
                <CardPreview canvas={sticker.finalCanvas} />
                <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {String(sticker.order).padStart(2, "0")}
                </span>
              </div>
              <div className="space-y-1 p-2">
                <p className="truncate text-xs font-semibold text-slate-700">{sticker.project?.text?.text || "—"}</p>
                <div className="flex flex-wrap gap-1">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${badge.className}`}>{badge.label}</span>
                  {sticker.aiStatus && (
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${AI_STATUS_BADGE[sticker.aiStatus].className}`}>
                      {AI_STATUS_BADGE[sticker.aiStatus].label}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
    </div>
  );
}
