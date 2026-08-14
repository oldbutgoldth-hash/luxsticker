import type { ColorThemeId, EmotionId, StyleId } from "@/types";

/**
 * Color theme system (Phase 3.1 spec §26) — each theme overrides a
 * project's text fill/outline color on top of whatever the Style preset
 * already set (styles/style-presets.ts's textColor/textOutlineColor stay
 * the fallback whenever no theme, or "auto" resolving to "mono", applies).
 * `rainbow` has no single color — `resolveColorThemeColor()` below cycles
 * through `rainbowCycle` by sticker index so a "rainbow" pack still reads
 * as one coherent theme rather than one random color per sticker.
 */
export interface ColorThemeDefinition {
  id: Exclude<ColorThemeId, "auto">;
  labelTh: string;
  swatch: string;
  textColor: string;
  textOutlineColor: string;
  rainbowCycle?: string[];
}

export const COLOR_THEMES: Record<Exclude<ColorThemeId, "auto">, ColorThemeDefinition> = {
  pink: { id: "pink", labelTh: "ชมพู", swatch: "#ff5fa2", textColor: "#ff5fa2", textOutlineColor: "#ffffff" },
  pastel: { id: "pastel", labelTh: "พาสเทล", swatch: "#ffd9ec", textColor: "#8a6a92", textOutlineColor: "#ffffff" },
  purple: { id: "purple", labelTh: "ม่วง", swatch: "#9b6bff", textColor: "#7c3aed", textOutlineColor: "#ffffff" },
  blue: { id: "blue", labelTh: "ฟ้า", swatch: "#4fb2ff", textColor: "#1d7fd6", textOutlineColor: "#ffffff" },
  mint: { id: "mint", labelTh: "มินท์", swatch: "#5be3c0", textColor: "#0f9d78", textOutlineColor: "#ffffff" },
  yellow: { id: "yellow", labelTh: "เหลือง", swatch: "#ffde00", textColor: "#e0a800", textOutlineColor: "#1a1a1a" },
  rainbow: {
    id: "rainbow",
    labelTh: "เรนโบว์",
    swatch: "linear-gradient(90deg,#ff5f5f,#ffde00,#5be3c0,#4fb2ff,#9b6bff)",
    textColor: "#ff5f5f",
    textOutlineColor: "#ffffff",
    rainbowCycle: ["#ff5f5f", "#ff9e4a", "#ffde00", "#5be3c0", "#4fb2ff", "#9b6bff", "#ff5fa2"],
  },
  mono: { id: "mono", labelTh: "โมโน", swatch: "#111111", textColor: "#111111", textOutlineColor: "#ffffff" },
  black_white: { id: "black_white", labelTh: "ขาวดำ", swatch: "#000000", textColor: "#000000", textOutlineColor: "#ffffff" },
};

export const COLOR_THEME_ORDER: Exclude<ColorThemeId, "auto">[] = [
  "pink",
  "pastel",
  "purple",
  "blue",
  "mint",
  "yellow",
  "rainbow",
  "mono",
  "black_white",
];

/** Spec §26 — "Auto ต้องเลือกตาม Emotion + Style": warm/soft emotions lean
 * pink/pastel, high-energy lean yellow/blue, calm/sad lean mono/mint. Style
 * also has a say — kawaii/chibi bias pastel/pink even for a so-so emotion,
 * comic biases yellow (its own signature color, matching STYLE_PRESETS.comic). */
const EMOTION_COLOR_THEME: Record<EmotionId, Exclude<ColorThemeId, "auto">> = {
  sawadee: "pink",
  thankyou: "pastel",
  ok: "mono",
  love: "pink",
  miss: "purple",
  haha: "yellow",
  happy: "rainbow",
  shy: "pastel",
  sulk: "purple",
  angry: "yellow",
  cry: "blue",
  hungry: "yellow",
  sleepy: "mint",
  tired: "mono",
  fight: "yellow",
  goodnight: "purple",
  custom: "mono",
};

const STYLE_COLOR_BIAS: Partial<Record<StyleId, Exclude<ColorThemeId, "auto">>> = {
  kawaii: "pink",
  chibi: "pastel",
  comic: "yellow",
  real: "mono",
};

export function resolveColorTheme(
  emotion: EmotionId,
  style: StyleId,
  packTheme: ColorThemeId,
  itemOverride?: ColorThemeId
): Exclude<ColorThemeId, "auto"> {
  const candidate = itemOverride ?? packTheme;
  if (candidate !== "auto") return candidate;
  return STYLE_COLOR_BIAS[style] ?? EMOTION_COLOR_THEME[emotion] ?? "mono";
}

/** Resolves the actual {color, outlineColor} pair for one sticker, handling
 * the rainbow theme's per-sticker cycling via `stickerIndex`. */
export function resolveThemeColors(
  theme: Exclude<ColorThemeId, "auto">,
  stickerIndex: number
): { color: string; outlineColor: string } {
  const def = COLOR_THEMES[theme];
  if (theme === "rainbow" && def.rainbowCycle && def.rainbowCycle.length > 0) {
    return { color: def.rainbowCycle[stickerIndex % def.rainbowCycle.length], outlineColor: def.textOutlineColor };
  }
  return { color: def.textColor, outlineColor: def.textOutlineColor };
}
