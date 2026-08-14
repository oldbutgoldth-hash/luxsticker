"use client";

import { useEffect, useRef } from "react";
import type { PackStickerItem } from "@/types";
import { STYLE_PRESETS } from "@/styles/style-presets";
import { FONT_CATALOG } from "@/config/font-catalog";
import { COLOR_THEMES } from "@/config/color-themes";

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

/**
 * Spec Phase 3 §21 — exact required wording: "✓ AI GENERATED" on success,
 * "✓ ORIGINAL CHARACTER" when a resolved fallback is in use, "⚠ AI FAILED"
 * while still unresolved. Only shown when this sticker actually went
 * through the AI Expression Engine (`aiStatus` is undefined for plain
 * Phase 2 stickers, which show no AI badge at all — honest about what
 * actually happened, spec §34).
 */
function aiBadgeFor(sticker: PackStickerItem): { label: string; className: string } | null {
  if (!sticker.aiStatus) return null;
  if (sticker.status === "needs_ai") return { label: "⚠ AI FAILED", className: "bg-red-100 text-red-600" };
  if (sticker.characterMode === "original_character") {
    return { label: "✓ ORIGINAL CHARACTER", className: "bg-amber-100 text-amber-700" };
  }
  if (sticker.aiStatus === "AI_READY") return { label: "✓ AI GENERATED", className: "bg-violet-100 text-violet-600" };
  if (sticker.aiStatus === "AI_GENERATING") return { label: "⏳ AI GENERATING", className: "bg-sky-100 text-sky-600" };
  if (sticker.aiStatus === "AI_PENDING") return { label: "⏳ AI PENDING", className: "bg-slate-100 text-slate-500" };
  return { label: "⚠ AI FAILED", className: "bg-red-100 text-red-600" };
}

/** Phase 3.1 §36 — "Style Badge / Font Badge / Color Theme" shown per card
 * in the Pack Dashboard, straight from what actually got rendered onto that
 * sticker's own StickerProject (not the pack's nominal settings) — so a
 * per-item override or a resolved "auto" value shows the truth for THIS
 * sticker, not just a copy of the pack-level choice. Only rendered when a
 * project exists (a pack generated before Phase 3.1, or one that never used
 * these fields, silently shows nothing extra — no fabricated badge). */
function designBadges(sticker: PackStickerItem): string[] {
  const project = sticker.project;
  if (!project) return [];
  const badges: string[] = [];
  const stylePreset = STYLE_PRESETS[project.style];
  if (stylePreset) badges.push(stylePreset.labelTh.toUpperCase());
  if (project.fontStyle && project.fontStyle !== "auto") {
    const fontEntry = FONT_CATALOG[project.fontStyle];
    if (fontEntry) badges.push(`${fontEntry.labelTh.toUpperCase()} FONT`);
  }
  if (project.colorTheme && project.colorTheme !== "auto") {
    const theme = COLOR_THEMES[project.colorTheme];
    if (theme) badges.push(theme.labelTh.toUpperCase());
  }
  return badges;
}

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
          const aiBadge = aiBadgeFor(sticker);
          const designBadgeLabels = designBadges(sticker);
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
                  {aiBadge && (
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${aiBadge.className}`}>{aiBadge.label}</span>
                  )}
                  {designBadgeLabels.map((label) => (
                    <span key={label} className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          );
        })}
    </div>
  );
}
