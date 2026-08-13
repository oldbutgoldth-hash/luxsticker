import type { CompositionPresetId, DecorationDensity, EmotionId } from "@/types";

/**
 * Composition presets (spec §11) — the Variation Engine's building blocks.
 * Each preset only *seeds* a starting character position/scale/rotation and
 * a text-size multiplier; the existing composition-engine's `autoCompose`
 * (Phase 1, untouched) still runs afterwards to avoid overlaps, keep text
 * on-canvas, and shrink an oversized character. This is deliberately a thin
 * layer ON TOP of the existing engine, not a replacement for it — moving the
 * character left/right/up/down before autoCompose runs is enough to make it
 * naturally choose a different, complementary text position each time.
 */
export interface CompositionPresetDefinition {
  id: CompositionPresetId;
  label: string;
  characterXFraction: number;
  characterYFraction: number;
  characterScaleMultiplier: number;
  textSizeMultiplier: number;
  /** Radians, applied to both character and text for a "tilted sticker" feel. */
  rotation: number;
  decorationDensity: DecorationDensity;
}

export const COMPOSITION_PRESETS: Record<CompositionPresetId, CompositionPresetDefinition> = {
  CENTER_TOP_TEXT: {
    id: "CENTER_TOP_TEXT",
    label: "กลาง / ข้อความบน",
    characterXFraction: 0.5,
    characterYFraction: 0.62,
    characterScaleMultiplier: 1,
    textSizeMultiplier: 1,
    rotation: 0,
    decorationDensity: "normal",
  },
  CENTER_BOTTOM_TEXT: {
    id: "CENTER_BOTTOM_TEXT",
    label: "กลาง / ข้อความล่าง",
    characterXFraction: 0.5,
    characterYFraction: 0.38,
    characterScaleMultiplier: 1,
    textSizeMultiplier: 1,
    rotation: 0,
    decorationDensity: "normal",
  },
  LEFT_CHARACTER_RIGHT_TEXT: {
    id: "LEFT_CHARACTER_RIGHT_TEXT",
    label: "ตัวละครซ้าย / ข้อความขวา",
    characterXFraction: 0.32,
    characterYFraction: 0.52,
    characterScaleMultiplier: 1,
    textSizeMultiplier: 1,
    rotation: 0,
    decorationDensity: "normal",
  },
  RIGHT_CHARACTER_LEFT_TEXT: {
    id: "RIGHT_CHARACTER_LEFT_TEXT",
    label: "ตัวละครขวา / ข้อความซ้าย",
    characterXFraction: 0.68,
    characterYFraction: 0.52,
    characterScaleMultiplier: 1,
    textSizeMultiplier: 1,
    rotation: 0,
    decorationDensity: "normal",
  },
  BIG_CHARACTER_TOP_TEXT: {
    id: "BIG_CHARACTER_TOP_TEXT",
    label: "ตัวละครใหญ่ / ข้อความบน",
    characterXFraction: 0.5,
    characterYFraction: 0.6,
    characterScaleMultiplier: 1.18,
    textSizeMultiplier: 1,
    rotation: 0,
    decorationDensity: "low",
  },
  SMALL_CHARACTER_BIG_TEXT: {
    id: "SMALL_CHARACTER_BIG_TEXT",
    label: "ตัวละครเล็ก / ข้อความใหญ่",
    characterXFraction: 0.5,
    characterYFraction: 0.55,
    characterScaleMultiplier: 0.66,
    textSizeMultiplier: 1.35,
    rotation: 0,
    decorationDensity: "low",
  },
  DIAGONAL: {
    id: "DIAGONAL",
    label: "แนวทแยง",
    characterXFraction: 0.42,
    characterYFraction: 0.55,
    characterScaleMultiplier: 0.95,
    textSizeMultiplier: 1,
    rotation: -0.1,
    decorationDensity: "normal",
  },
  COMIC_BURST: {
    id: "COMIC_BURST",
    label: "คอมิกระเบิด",
    characterXFraction: 0.5,
    characterYFraction: 0.5,
    characterScaleMultiplier: 1,
    textSizeMultiplier: 1.08,
    rotation: 0,
    decorationDensity: "high",
  },
  HEART_FRAME: {
    id: "HEART_FRAME",
    label: "กรอบหัวใจ",
    characterXFraction: 0.5,
    characterYFraction: 0.55,
    characterScaleMultiplier: 1,
    textSizeMultiplier: 1,
    rotation: 0,
    decorationDensity: "normal",
  },
  MINIMAL: {
    id: "MINIMAL",
    label: "มินิมอล",
    characterXFraction: 0.5,
    characterYFraction: 0.5,
    characterScaleMultiplier: 1,
    textSizeMultiplier: 0.92,
    rotation: 0,
    decorationDensity: "none",
  },
};

export const COMPOSITION_PRESET_IDS: CompositionPresetId[] = Object.keys(
  COMPOSITION_PRESETS
) as CompositionPresetId[];

/** How many decoration slots each density maps to (decoration-engine's
 * candidate-slot placement already avoids collisions; this just controls
 * how many of those slots get filled). */
export const DECORATION_DENSITY_COUNT: Record<DecorationDensity, number> = {
  none: 0,
  low: 1,
  normal: 3,
  high: 4,
};

/**
 * Which composition presets suit each emotion (spec §11: "Engine ต้องเลือกให้
 * เหมาะกับ Emotion"). Selection cycles through the list by sticker index so
 * repeated emotions in a big pack still vary (spec §10).
 */
export const EMOTION_COMPOSITION_AFFINITY: Record<EmotionId, CompositionPresetId[]> = {
  sawadee: ["LEFT_CHARACTER_RIGHT_TEXT", "CENTER_TOP_TEXT", "RIGHT_CHARACTER_LEFT_TEXT"],
  thankyou: ["CENTER_BOTTOM_TEXT", "RIGHT_CHARACTER_LEFT_TEXT", "HEART_FRAME"],
  ok: ["MINIMAL", "LEFT_CHARACTER_RIGHT_TEXT", "CENTER_TOP_TEXT"],
  love: ["HEART_FRAME", "CENTER_BOTTOM_TEXT", "DIAGONAL"],
  miss: ["HEART_FRAME", "CENTER_TOP_TEXT", "RIGHT_CHARACTER_LEFT_TEXT"],
  haha: ["COMIC_BURST", "DIAGONAL", "BIG_CHARACTER_TOP_TEXT"],
  happy: ["BIG_CHARACTER_TOP_TEXT", "COMIC_BURST", "CENTER_TOP_TEXT"],
  shy: ["SMALL_CHARACTER_BIG_TEXT", "MINIMAL", "HEART_FRAME"],
  sulk: ["DIAGONAL", "LEFT_CHARACTER_RIGHT_TEXT", "SMALL_CHARACTER_BIG_TEXT"],
  angry: ["COMIC_BURST", "DIAGONAL", "BIG_CHARACTER_TOP_TEXT"],
  cry: ["SMALL_CHARACTER_BIG_TEXT", "CENTER_BOTTOM_TEXT", "MINIMAL"],
  hungry: ["BIG_CHARACTER_TOP_TEXT", "LEFT_CHARACTER_RIGHT_TEXT", "COMIC_BURST"],
  sleepy: ["MINIMAL", "SMALL_CHARACTER_BIG_TEXT", "CENTER_BOTTOM_TEXT"],
  tired: ["MINIMAL", "SMALL_CHARACTER_BIG_TEXT", "CENTER_BOTTOM_TEXT"],
  fight: ["BIG_CHARACTER_TOP_TEXT", "COMIC_BURST", "RIGHT_CHARACTER_LEFT_TEXT"],
  goodnight: ["CENTER_BOTTOM_TEXT", "MINIMAL", "HEART_FRAME"],
  custom: ["CENTER_TOP_TEXT", "LEFT_CHARACTER_RIGHT_TEXT", "RIGHT_CHARACTER_LEFT_TEXT", "CENTER_BOTTOM_TEXT"],
};

/**
 * Extended decoration palette per emotion (spec §12 — Stars/Sparkles/Heart/
 * Comic Burst/Speed Lines/Sweat/Tears/Angry Mark/Confetti/Glow/Cloud/Motion
 * Lines, mapped to real emoji glyphs the existing decoration-engine already
 * knows how to draw). Overrides the Style-level palette used by the
 * single-sticker flow so a pack doesn't repeat the same 2-3 glyphs forty times.
 */
export const EMOTION_DECORATION_GLYPHS: Record<EmotionId, string[]> = {
  sawadee: ["✨", "⭐"],
  thankyou: ["💕", "✨"],
  ok: ["✨", "⭐"],
  love: ["❤️", "💕", "✨"],
  miss: ["💕", "✨"],
  haha: ["💥", "🎉"],
  happy: ["🎉", "✨", "⭐"],
  shy: ["💕", "✨"],
  sulk: ["💢"],
  angry: ["💢", "💥"],
  cry: ["😭", "💦"],
  hungry: ["💦", "⭐"],
  sleepy: ["💤", "☁️"],
  tired: ["💦", "☁️"],
  fight: ["💥", "⭐", "✨"],
  goodnight: ["✨", "☁️"],
  custom: ["✨", "⭐"],
};
