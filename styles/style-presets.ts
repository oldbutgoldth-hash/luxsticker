import type { OutlineConfig, StyleId } from "@/types";

/**
 * One preset per Style (spec §5/§8/§9). Adding a new style later means
 * adding one entry here — no other code needs to change (Architecture §17).
 *
 * Phase 3.1 adds `promptDirective` (spec §4 CARTOON STYLE PRESETS): the art-
 * direction text used ONLY when this style's AI Cartoon Transformation runs
 * (lib/expression-prompt-builder.ts appends it to the shared prompt builder
 * — see transformToCartoon() in lib/expression-pipeline.ts). `real` has no
 * meaningful directive because Mode A never calls AI Art Transformation at
 * all (spec §3 — isRealPhotoStyle() short-circuits it upstream).
 */
export interface StylePreset {
  id: StyleId;
  labelTh: string;
  emoji: string;
  outline: OutlineConfig;
  decorationGlyphs: string[];
  fontFamily: string;
  fontWeight: number;
  textColor: string;
  textOutlineColor: string;
  /** Background swatch shown behind the pick card in the UI only. */
  swatch: string;
  promptDirective: string;
}

export const STYLE_PRESETS: Record<StyleId, StylePreset> = {
  cute: {
    id: "cute",
    labelTh: "น่ารัก",
    emoji: "🥰",
    outline: { style: "white", widthPx: 14 },
    decorationGlyphs: ["⭐", "💕", "✨"],
    fontFamily: "var(--font-mitr)",
    fontWeight: 600,
    textColor: "#4a2b52",
    textOutlineColor: "#ffffff",
    swatch: "#ffd9ec",
    promptDirective: "cute soft pastel illustration style, gentle rounded shapes, warm friendly expression",
  },
  funny: {
    id: "funny",
    labelTh: "ฮา",
    emoji: "😂",
    outline: { style: "thick", widthPx: 20 },
    decorationGlyphs: ["💥", "💨"],
    fontFamily: "var(--font-kanit)",
    fontWeight: 800,
    textColor: "#ffde00",
    textOutlineColor: "#1a1a1a",
    swatch: "#fff3b0",
    promptDirective: "bold comedic high-contrast illustration style, exaggerated playful expression",
  },
  kawaii: {
    id: "kawaii",
    labelTh: "คาวาอี้",
    emoji: "🎀",
    outline: { style: "double", widthPx: 16, secondaryColor: "#ff9ec9" },
    decorationGlyphs: ["⭐", "✨", "💕"],
    fontFamily: "var(--font-mitr)",
    fontWeight: 700,
    textColor: "#ff5fa2",
    textOutlineColor: "#ffffff",
    swatch: "#ffe1f4",
    promptDirective:
      "kawaii illustration style, soft pastel color palette, big sparkling expressive eyes, gentle rounded shapes, cute charming proportions",
  },
  real: {
    id: "real",
    labelTh: "ภาพจริง",
    emoji: "📷",
    outline: { style: "soft-white", widthPx: 10 },
    decorationGlyphs: ["✨"],
    fontFamily: "var(--font-prompt)",
    fontWeight: 600,
    textColor: "#ffffff",
    textOutlineColor: "#111111",
    swatch: "#e7ecf3",
    promptDirective: "",
  },
  // ---- Phase 3.1 §4: the 4 new Character Art Styles ----
  cartoon: {
    id: "cartoon",
    labelTh: "การ์ตูน",
    emoji: "🎨",
    outline: { style: "thick", widthPx: 18 },
    decorationGlyphs: ["✨", "⭐", "💥"],
    fontFamily: "var(--font-kanit)",
    fontWeight: 700,
    textColor: "#1a1a2e",
    textOutlineColor: "#ffffff",
    swatch: "#c9e8ff",
    promptDirective:
      "clean modern cartoon illustration style, bold clean linework, bright saturated colors, smooth flat shading, natural friendly cartoon facial proportions",
  },
  chibi: {
    id: "chibi",
    labelTh: "ชิบิ",
    emoji: "🧸",
    outline: { style: "double", widthPx: 16, secondaryColor: "#ffb3d1" },
    decorationGlyphs: ["💕", "⭐", "✨"],
    fontFamily: "var(--font-mali)",
    fontWeight: 700,
    textColor: "#ff5fa2",
    textOutlineColor: "#ffffff",
    swatch: "#ffe8f0",
    promptDirective:
      "chibi character illustration style, oversized head with a small simplified body, big sparkling expressive eyes, exaggerated cute proportions, soft rounded shapes",
  },
  comic: {
    id: "comic",
    labelTh: "คอมมิค",
    emoji: "💥",
    outline: { style: "black", widthPx: 20 },
    decorationGlyphs: ["💥", "⚡", "💨"],
    fontFamily: "var(--font-kanit)",
    fontWeight: 900,
    textColor: "#ffde00",
    textOutlineColor: "#000000",
    swatch: "#fff3b0",
    promptDirective:
      "comic book illustration style, bold black ink outlines, dynamic dramatic shading, flat bold comic coloring, energetic dynamic pose",
  },
  hand_drawn: {
    id: "hand_drawn",
    labelTh: "วาดมือ",
    emoji: "✏️",
    outline: { style: "soft-white", widthPx: 10 },
    decorationGlyphs: ["✨", "☁️", "🌿"],
    fontFamily: "var(--font-charmonman)",
    fontWeight: 700,
    textColor: "#6b4423",
    textOutlineColor: "#fffaf0",
    swatch: "#fff3e0",
    promptDirective:
      "hand-drawn doodle illustration style, sketchy imperfect linework, warm soft coloring, charming handmade imperfect feel",
  },
};

/** Legacy order — kept unchanged so any existing code iterating "every
 * style" still sees Phase 1/2's original 4 first (spec §1: don't rebuild). */
export const STYLE_ORDER: StyleId[] = ["cute", "funny", "kawaii", "real"];

/** Phase 3.1 §30 — the exact 6-item Style panel the spec asks for (Real
 * Photo / Cartoon / Kawaii / Chibi / Comic / Hand Drawn). Used by the new
 * Style picker UI; `cute`/`funny` stay selectable via STYLE_PRESETS/STYLE_ORDER
 * for backward compatibility but are no longer offered as fresh choices. */
export const STYLE_ORDER_V2: StyleId[] = ["real", "cartoon", "kawaii", "chibi", "comic", "hand_drawn"];
