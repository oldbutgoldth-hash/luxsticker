/**
 * White outline thickness, relative to rendered image size (Phase 3.1
 * spec §27: "สามารถปรับ Thickness เช่น 4/6/8/10/12 แต่ต้องคำนวณสัมพันธ์กับขนาดภาพ").
 *
 * Why this matters: `engines/outline-engine`'s `generateOutlineCanvas`
 * dilates the character's alpha mask by a flat `widthPx` value on the fixed
 * 1200x1200 working canvas (lib/project-factory.ts's CANVAS_SIZE). But a
 * pack sticker's character isn't always drawn at the same size — Phase 3.1's
 * new FULL_BODY/HALF_BODY/CLOSE_UP composition presets (and the pre-existing
 * BIG_CHARACTER_TOP_TEXT/SMALL_CHARACTER_BIG_TEXT ones) deliberately vary
 * `characterScaleMultiplier`. A flat outline width would look proportionally
 * thick on a shrunk-down character and proportionally thin on a zoomed-in
 * one. Since `lib/pack-pipeline.ts`'s `buildProjectForPlanItem` renders the
 * character at exactly `targetSpan * characterScaleMultiplier` (a fixed
 * `targetSpan`, scaled by that same multiplier), scaling the outline width
 * by the identical multiplier keeps it visually proportionate to the
 * character automatically — no separate "measure the character, then
 * compute a ratio" step needed at render time.
 */
const MIN_OUTLINE_WIDTH_PX = 3;
const MAX_OUTLINE_WIDTH_PX = 48;

/** The discrete thickness levels the Outline panel offers (spec §27's exact
 * list) — a "level" here is literally the widthPx used at the reference
 * scale (characterScaleMultiplier === 1, i.e. a HALF_BODY-ish shot). */
export const OUTLINE_THICKNESS_LEVELS = [4, 6, 8, 10, 12] as const;
export type OutlineThicknessLevel = (typeof OUTLINE_THICKNESS_LEVELS)[number];

export function resolveOutlineWidthPx(baseWidthPx: number, characterScaleMultiplier: number): number {
  const scaled = Math.round(baseWidthPx * characterScaleMultiplier);
  return Math.max(MIN_OUTLINE_WIDTH_PX, Math.min(MAX_OUTLINE_WIDTH_PX, scaled));
}
