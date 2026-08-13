import type { OutlineConfig, StyleId } from "@/types";

/**
 * One preset per Style (spec §5/§8/§9). Adding a new style later means
 * adding one entry here — no other code needs to change (Architecture §17).
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
  },
};

export const STYLE_ORDER: StyleId[] = ["cute", "funny", "kawaii", "real"];
