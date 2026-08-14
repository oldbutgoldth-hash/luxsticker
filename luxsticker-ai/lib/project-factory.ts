import type { CharacterLayer, EmotionId, StickerProject, StyleId, TextLayer } from "@/types";
import { STYLE_PRESETS } from "@/styles/style-presets";
import { getEmotionPreset } from "@/styles/emotion-presets";

export const CANVAS_SIZE = { width: 1200, height: 1200 };
const BASE_FONT_SIZE_PX = 132;

let idCounter = 0;
export function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}-${Date.now().toString(36)}`;
}

export function buildTextLayer(style: StyleId, emotion: EmotionId, customText: string): TextLayer {
  const preset = STYLE_PRESETS[style];
  const text = customText.trim() || getEmotionPreset(emotion).defaultText || "สวัสดี";
  return {
    id: "text-main",
    kind: "text",
    x: CANVAS_SIZE.width / 2,
    y: CANVAS_SIZE.height * 0.2,
    scale: 1,
    rotation: 0,
    zIndex: 30,
    text,
    fontFamily: preset.fontFamily,
    fontSizePx: BASE_FONT_SIZE_PX,
    fontWeight: preset.fontWeight,
    color: preset.textColor,
    outlineColor: preset.textOutlineColor,
    outlineWidthPx: 10,
    shadow: true,
  };
}

export function createInitialProject(
  character: CharacterLayer,
  style: StyleId,
  emotion: EmotionId,
  customText: string
): StickerProject {
  const preset = STYLE_PRESETS[style];
  return {
    id: nextId("project"),
    style,
    emotion,
    character,
    text: buildTextLayer(style, emotion, customText),
    decorations: [],
    outline: { ...preset.outline },
    canvasSize: CANVAS_SIZE,
  };
}
