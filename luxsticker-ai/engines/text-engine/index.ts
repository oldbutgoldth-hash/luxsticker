import type { Rect, TextLayer } from "@/types";
import { resolveCssFontVar } from "@/lib/fonts";

const LINE_HEIGHT_RATIO = 1.22;

function buildFontString(layer: TextLayer): string {
  const family = resolveCssFontVar(layer.fontFamily);
  return `${layer.fontWeight} ${layer.fontSizePx}px ${family}`;
}

function getLines(layer: TextLayer): string[] {
  return layer.text.length > 0 ? layer.text.split("\n") : [""];
}

/** Unrotated, unscaled local-space size of the text block (before the
 * layer's own scale/rotation transform is applied). */
export function measureTextLayerLocal(
  ctx: CanvasRenderingContext2D,
  layer: TextLayer
): { width: number; height: number } {
  ctx.save();
  ctx.font = buildFontString(layer);
  const lines = getLines(layer);
  const width = Math.max(1, ...lines.map((l) => ctx.measureText(l || " ").width));
  const height = lines.length * layer.fontSizePx * LINE_HEIGHT_RATIO;
  ctx.restore();
  return { width, height };
}

/** Axis-aligned bounding rect in canvas space, accounting for scale and
 * rotation — used by composition (collision avoidance), crop, and
 * validation ("Text ถูกตัดหรือไม่"). */
export function getTextLayerRect(ctx: CanvasRenderingContext2D, layer: TextLayer): Rect {
  const { width, height } = measureTextLayerLocal(ctx, layer);
  const w = width * layer.scale;
  const h = height * layer.scale;
  const cos = Math.abs(Math.cos(layer.rotation));
  const sin = Math.abs(Math.sin(layer.rotation));
  const aabbW = w * cos + h * sin;
  const aabbH = w * sin + h * cos;
  return {
    x: layer.x - aabbW / 2,
    y: layer.y - aabbH / 2,
    width: aabbW,
    height: aabbH,
  };
}

/** Renders the text layer: outline stroke (or double-pass for legibility),
 * optional drop shadow, then the fill — matching the "big, fun typography
 * with a light/dark outline" reference look (spec §7/§Reference). */
export function drawTextLayer(ctx: CanvasRenderingContext2D, layer: TextLayer) {
  if (!layer.text.trim()) return;

  ctx.save();
  ctx.translate(layer.x, layer.y);
  ctx.rotate(layer.rotation);
  ctx.scale(layer.scale, layer.scale);
  ctx.font = buildFontString(layer);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;

  const lines = getLines(layer);
  const lineHeight = layer.fontSizePx * LINE_HEIGHT_RATIO;
  const totalHeight = lines.length * lineHeight;
  const startY = -totalHeight / 2 + lineHeight / 2;

  if (layer.shadow) {
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = Math.max(2, layer.fontSizePx * 0.06);
    ctx.shadowOffsetX = layer.fontSizePx * 0.03;
    ctx.shadowOffsetY = layer.fontSizePx * 0.05;
  }

  lines.forEach((line, i) => {
    const y = startY + i * lineHeight;
    if (layer.outlineWidthPx > 0) {
      ctx.strokeStyle = layer.outlineColor;
      ctx.lineWidth = layer.outlineWidthPx;
      ctx.strokeText(line, 0, y);
    }
  });

  // Fill pass drawn without shadow duplication artifacts.
  ctx.shadowColor = "transparent";
  ctx.fillStyle = layer.color;
  lines.forEach((line, i) => {
    const y = startY + i * lineHeight;
    ctx.fillText(line, 0, y);
  });

  ctx.restore();
}
