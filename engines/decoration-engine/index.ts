import type { CanvasSize, DecorationLayer, EmotionId, Rect, StyleId } from "@/types";
import { STYLE_PRESETS } from "@/styles/style-presets";
import { getEmotionPreset } from "@/styles/emotion-presets";
import { rectsIntersect } from "@/lib/canvas-utils";

export const DECORATION_BASE_SIZE_PX = 72;
const MAX_DECORATIONS = 4;

/** Candidate placement slots, expressed as fractions of the canvas, ordered
 * by how "sticker-like" they read (corners first, then edge midpoints). */
const CANDIDATE_SLOTS: Array<{ fx: number; fy: number }> = [
  { fx: 0.12, fy: 0.14 },
  { fx: 0.88, fy: 0.14 },
  { fx: 0.12, fy: 0.86 },
  { fx: 0.88, fy: 0.86 },
  { fx: 0.5, fy: 0.08 },
  { fx: 0.08, fy: 0.5 },
  { fx: 0.92, fy: 0.5 },
  { fx: 0.5, fy: 0.92 },
];

export function getDecorationRect(layer: DecorationLayer): Rect {
  const size = DECORATION_BASE_SIZE_PX * layer.scale;
  return { x: layer.x - size / 2, y: layer.y - size / 2, width: size, height: size };
}

export function drawDecorationLayer(ctx: CanvasRenderingContext2D, layer: DecorationLayer) {
  ctx.save();
  ctx.translate(layer.x, layer.y);
  ctx.rotate(layer.rotation);
  ctx.font = `${DECORATION_BASE_SIZE_PX * layer.scale}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(layer.glyph, 0, 0);
  ctx.restore();
}

/**
 * Picks decoration glyphs for the chosen Style + Emotion (spec §9 — each
 * style has an appropriate default set, e.g. Cute → stars/hearts/sparkles,
 * Funny → comic burst, Angry → 💢 + speed lines) and places them in free
 * canvas regions that don't collide with the character or text bounding
 * boxes, or with each other (spec §10: "ไม่ทำให้ Decoration ชนกัน").
 */
export function generateDecorations(
  style: StyleId,
  emotion: EmotionId,
  canvasSize: CanvasSize,
  avoidRects: Rect[]
): DecorationLayer[] {
  const preset = STYLE_PRESETS[style];
  const emotionGlyph = getEmotionPreset(emotion).emphasisGlyph;
  const glyphPool = Array.from(new Set([...preset.decorationGlyphs, ...(emotionGlyph ? [emotionGlyph] : [])]));

  const placed: DecorationLayer[] = [];
  const reserved = [...avoidRects];

  for (let i = 0; i < CANDIDATE_SLOTS.length && placed.length < MAX_DECORATIONS; i++) {
    const slot = CANDIDATE_SLOTS[i];
    const glyph = glyphPool[placed.length % glyphPool.length];
    const x = slot.fx * canvasSize.width;
    const y = slot.fy * canvasSize.height;
    const scale = 0.85 + ((i * 37) % 30) / 100; // gentle deterministic size variety
    const candidate: DecorationLayer = {
      id: `deco-${i}`,
      kind: "decoration",
      x,
      y,
      scale,
      rotation: ((i % 2 === 0 ? -1 : 1) * Math.PI) / 14,
      zIndex: 20,
      glyph,
    };
    const rect = getDecorationRect(candidate);
    const collides = reserved.some((r) => rectsIntersect(r, rect));
    if (!collides) {
      placed.push(candidate);
      reserved.push(rect);
    }
  }

  return placed;
}
