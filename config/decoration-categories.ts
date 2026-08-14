import type { DecorationCategoryId, EmotionId, StyleId } from "@/types";

/**
 * Decoration category library (Phase 3.1 spec §16) — real, distinct glyph
 * pools per category, independent of the per-emotion palette
 * (config/composition-presets.ts's EMOTION_DECORATION_GLYPHS) that already
 * existed from Phase 2. `"auto"` has no entry — resolveDecorationCategory()
 * below maps it to a concrete category from the sticker's Emotion.
 *
 * Implementation note: like Phase 1/2's decoration engine, these are emoji
 * glyphs drawn on canvas (engines/decoration-engine), not hand-drawn vector
 * icon sets per style — that keeps this consistent with the existing,
 * already-shipped rendering mechanism rather than introducing a second,
 * parallel decoration-drawing system. Style-appropriate *feel* (spec §17 —
 * cartoon/kawaii/comic/hand-drawn should each look different) comes from
 * `resolveDecorationGlyphs()` biasing which glyphs from the category pool
 * get used first, not from redrawing the glyphs themselves.
 */
export const DECORATION_CATEGORIES: Record<Exclude<DecorationCategoryId, "auto">, { labelTh: string; glyphs: string[] }> = {
  love: { labelTh: "รัก", glyphs: ["❤️", "💕", "💘", "😘", "💋"] },
  happy: { labelTh: "ดีใจ", glyphs: ["🎉", "⭐", "🌈", "💥", "✨"] },
  sad: { labelTh: "เศร้า", glyphs: ["😭", "☁️", "🌧️", "💧"] },
  angry: { labelTh: "โกรธ", glyphs: ["💢", "💥", "⚡"] },
  hungry: { labelTh: "หิว", glyphs: ["🍔", "🍽️", "🥄", "🍴", "🍕"] },
  travel: { labelTh: "ท่องเที่ยว", glyphs: ["📷", "🧳", "✈️", "🌴", "🗺️"] },
  sleep: { labelTh: "นอน", glyphs: ["🌙", "☁️", "💤", "⭐"] },
  funny: { labelTh: "ตลก", glyphs: ["😂", "💥", "💨", "🤣"] },
};

export const DECORATION_CATEGORY_ORDER: Exclude<DecorationCategoryId, "auto">[] = [
  "love",
  "happy",
  "sad",
  "angry",
  "hungry",
  "travel",
  "sleep",
  "funny",
];

/** Spec §26/§30's "Auto" resolution for decoration — reuses the same
 * emotion groupings the category table above was built from, so "Auto"
 * genuinely tracks each sticker's own emotion rather than a pack-wide
 * constant. */
const EMOTION_TO_DECORATION_CATEGORY: Record<EmotionId, Exclude<DecorationCategoryId, "auto">> = {
  sawadee: "happy",
  thankyou: "love",
  ok: "happy",
  love: "love",
  miss: "love",
  haha: "funny",
  happy: "happy",
  shy: "love",
  sulk: "angry",
  angry: "angry",
  cry: "sad",
  hungry: "hungry",
  sleepy: "sleep",
  tired: "sleep",
  fight: "angry",
  goodnight: "sleep",
  custom: "happy",
};

export function resolveDecorationCategory(
  emotion: EmotionId,
  packCategory: DecorationCategoryId,
  itemOverride?: DecorationCategoryId
): Exclude<DecorationCategoryId, "auto"> {
  const candidate = itemOverride ?? packCategory;
  if (candidate !== "auto") return candidate;
  return EMOTION_TO_DECORATION_CATEGORY[emotion] ?? "happy";
}

/** Spec §17 — "Decoration ต้องเปลี่ยนตาม Style". A small "signature glyph"
 * bias per Style: glyphs in a style's bias list that also exist in the
 * resolved category's pool are moved to the front, so e.g. a Kawaii pack's
 * decorations lean pastel/soft (✨💕⭐) even inside the "angry" category,
 * while a Comic pack's decorations lean bold/graphic (💥⚡) even inside the
 * "love" category — without needing a separate icon set per style. */
const STYLE_GLYPH_BIAS: Partial<Record<StyleId, string[]>> = {
  kawaii: ["✨", "💕", "⭐", "🌸"],
  chibi: ["✨", "💕", "⭐"],
  cute: ["✨", "💕", "⭐"],
  comic: ["💥", "⚡", "💨"],
  funny: ["💥", "💨"],
  hand_drawn: ["✨", "☁️", "🌿"],
  cartoon: ["✨", "⭐", "💥"],
  real: [],
};

export function resolveDecorationGlyphs(
  category: Exclude<DecorationCategoryId, "auto">,
  style: StyleId,
  emotionGlyph?: string | null
): string[] {
  const pool = DECORATION_CATEGORIES[category].glyphs;
  const bias = STYLE_GLYPH_BIAS[style] ?? [];
  const biased = [...pool].sort((a, b) => {
    const aBias = bias.includes(a) ? 0 : 1;
    const bBias = bias.includes(b) ? 0 : 1;
    return aBias - bBias;
  });
  if (emotionGlyph && !biased.includes(emotionGlyph)) biased.unshift(emotionGlyph);
  return Array.from(new Set(biased));
}
