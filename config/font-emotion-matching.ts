import type { EmotionId, FontStyleId } from "@/types";

/**
 * Font + Emotion matching (Phase 3.1 spec §12) — exact examples from the
 * spec are mapped 1:1 below; every other EmotionId gets a reasoned pick
 * using the same logic (soft/cute emotions -> kawaii/cute/handwritten,
 * high-energy emotions -> bold/comic, calm/neutral -> minimal).
 *
 *   "สวัสดี"      -> Kawaii / Round      -> kawaii
 *   "ขอบคุณ"      -> Handwritten / Cute  -> handwritten
 *   "555"         -> Playful / Comic     -> comic
 *   "สู้ๆ"         -> Bold / Comic        -> bold
 *   "โกรธแล้วนะ"   -> Comic / Brush       -> brush
 *   "รักนะ"       -> Cute / Handwritten  -> handwritten
 *   "ฝันดี"       -> Soft / Rounded      -> cute
 */
export const EMOTION_FONT_STYLE: Record<EmotionId, Exclude<FontStyleId, "auto">> = {
  sawadee: "kawaii",
  thankyou: "handwritten",
  ok: "minimal",
  love: "handwritten",
  miss: "handwritten",
  haha: "comic",
  happy: "comic",
  shy: "cute",
  sulk: "bold",
  angry: "brush",
  cry: "cute",
  hungry: "comic",
  sleepy: "minimal",
  tired: "minimal",
  fight: "bold",
  goodnight: "cute",
  custom: "cute",
};

/**
 * Resolves the FontStyleId actually used to render one sticker's text
 * (spec §23/§24): an explicit per-item override wins, then the pack-level
 * choice (if not "auto"), then — for Auto Design — the emotion match table
 * above.
 */
export function resolveFontStyle(
  emotion: EmotionId,
  packFontStyle: FontStyleId,
  itemOverride?: FontStyleId
): Exclude<FontStyleId, "auto"> {
  const candidate = itemOverride ?? packFontStyle;
  if (candidate !== "auto") return candidate;
  return EMOTION_FONT_STYLE[emotion] ?? "cute";
}
