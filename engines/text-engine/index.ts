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

/**
 * Groups each base character with any combining marks that follow it (spec
 * §15: "ห้ามสระลอยผิด, วรรณยุกต์หาย" — Thai vowel signs and tone marks like
 * ่ ้ ๊ ๋ ั ิ ี ึ ื ุ ู must never be separated from the consonant they
 * attach to). This matters specifically for `drawCurvedLine` below, which
 * lays glyphs out one at a time along an arc — splitting `text` by raw
 * UTF-16/codepoint (`Array.from`/`for...of`) would place a tone mark at its
 * OWN position on the arc, visually detached from its base character. Using
 * the Unicode "Mark, nonspacing" (`\p{Mn}`) category keeps every combining
 * mark glued to the character before it, so curved Thai text still reads
 * correctly. Plain (non-curved) rendering never hits this function — a
 * normal `strokeText`/`fillText` call already handles combining marks
 * correctly on its own, since it's not decomposing the string itself.
 */
function splitGraphemeClusters(text: string): string[] {
  const clusters: string[] = [];
  for (const ch of text) {
    if (clusters.length > 0 && /\p{Mn}/u.test(ch)) {
      clusters[clusters.length - 1] += ch;
    } else {
      clusters.push(ch);
    }
  }
  return clusters;
}

/** Unrotated, unscaled local-space size of the text block (before the
 * layer's own scale/rotation transform is applied). Phase 3.1: pads the
 * width slightly for `curved` text, since bowing the line along an arc
 * makes its true footprint a little wider than the flat measurement. */
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
  const curvedPad = layer.textComposition === "curved" ? 1.12 : 1;
  return { width: width * curvedPad, height: height * curvedPad };
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

/** Phase 3.1 §13 — per-line scale multiplier for the `stacked`/`mixed` text
 * treatments. `stacked`: alternating big/small lines, a common "trendy
 * sticker typography" look for short multi-line phrases. `mixed`: first
 * line reads as the emphasis line (bigger), the rest supporting (smaller) —
 * e.g. "555" big, "5555555" smaller underneath. Anything else (or a
 * single-line layer) is unaffected — this only kicks in with 2+ lines. */
function lineScaleFor(layer: TextLayer, lineIndex: number, lineCount: number): number {
  if (lineCount < 2) return 1;
  if (layer.textComposition === "stacked") return lineIndex % 2 === 0 ? 1.18 : 0.86;
  if (layer.textComposition === "mixed") return lineIndex === 0 ? 1.25 : 0.8;
  return 1;
}

/** One glyph-by-glyph pass along a gentle arc (spec §14 `curved`) — bows the
 * line so it reads like text wrapped around the top of a badge/sticker,
 * without needing a path/font library. `strokeFirst` lets the caller do the
 * same outline-then-fill two-pass approach curved text still needs for
 * legibility. */
function drawCurvedLine(
  ctx: CanvasRenderingContext2D,
  line: string,
  centerY: number,
  radius: number,
  mode: "stroke" | "fill"
) {
  if (!line) return;
  // Each "glyph" here is a base character + any combining marks attached to
  // it (splitGraphemeClusters) — never split further, so Thai tone marks/
  // vowel signs travel along the arc together with their consonant.
  const clusters = splitGraphemeClusters(line);
  const widths = clusters.map((cluster) => ctx.measureText(cluster).width);
  const totalWidth = widths.reduce((a, b) => a + b, 0);
  const totalAngle = Math.min(Math.PI * 0.7, totalWidth / radius);
  let angle = -totalAngle / 2;
  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i];
    const clusterWidth = widths[i];
    const clusterAngle = clusterWidth / radius;
    const glyphAngle = angle + clusterAngle / 2;
    ctx.save();
    ctx.translate(Math.sin(glyphAngle) * radius, centerY - Math.cos(glyphAngle) * radius);
    ctx.rotate(glyphAngle);
    if (mode === "stroke") ctx.strokeText(cluster, 0, 0);
    else ctx.fillText(cluster, 0, 0);
    ctx.restore();
    angle += clusterAngle;
  }
}

/** Renders the text layer: outline stroke (or double-pass for legibility),
 * optional glow / offset shadow / soft shadow, then the fill — matching the
 * "big, fun typography with a light/dark outline" reference look (spec
 * §7/§Reference, extended Phase 3.1 §13/§14 with glow/offset-shadow and
 * curved/stacked/mixed placement treatments). */
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

  // Curved text uses its own two-pass (stroke then fill) glyph-by-glyph
  // renderer instead of the straight-line strokeText/fillText below — glow/
  // offset-shadow/soft-shadow still apply the same way (canvas shadow state
  // works per-draw-call regardless of what's being drawn).
  const isCurved = layer.textComposition === "curved" && lines.length > 0;
  const curveRadius = Math.max(layer.fontSizePx * 2.6, measureTextLayerLocal(ctx, layer).width / 1.1);

  const drawPass = (mode: "stroke" | "fill") => {
    lines.forEach((line, i) => {
      const scale = lineScaleFor(layer, i, lines.length);
      const y = startY + i * lineHeight;
      if (isCurved) {
        ctx.save();
        ctx.scale(scale, scale);
        drawCurvedLine(ctx, line, y / scale, curveRadius / scale, mode);
        ctx.restore();
        return;
      }
      if (scale !== 1) {
        ctx.save();
        ctx.translate(0, y);
        ctx.scale(scale, scale);
        if (mode === "stroke") ctx.strokeText(line, 0, 0);
        else ctx.fillText(line, 0, 0);
        ctx.restore();
        return;
      }
      if (mode === "stroke") ctx.strokeText(line, 0, y);
      else ctx.fillText(line, 0, y);
    });
  };

  // Offset shadow (spec §13 "Offset Shadow") — a hard, unblurred duplicate
  // drawn behind everything else, comic/sticker "3D pop" look. Drawn first
  // so the glow/outline/fill passes composite cleanly on top.
  if (layer.offsetShadow) {
    ctx.save();
    ctx.translate(layer.fontSizePx * 0.07, layer.fontSizePx * 0.09);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.shadowColor = "transparent";
    drawPass("fill");
    ctx.restore();
  }

  // Glow (spec §13 "Glow") — several progressively-tighter blurred fill
  // passes in the text's own fill color, buillt up behind the crisp text so
  // it reads as a soft halo rather than a single flat blur.
  if (layer.glow) {
    ctx.save();
    ctx.fillStyle = layer.color;
    ctx.shadowColor = layer.color;
    [layer.fontSizePx * 0.5, layer.fontSizePx * 0.3, layer.fontSizePx * 0.16].forEach((blur) => {
      ctx.shadowBlur = blur;
      drawPass("fill");
    });
    ctx.restore();
  }

  if (layer.shadow) {
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = Math.max(2, layer.fontSizePx * 0.06);
    ctx.shadowOffsetX = layer.fontSizePx * 0.03;
    ctx.shadowOffsetY = layer.fontSizePx * 0.05;
  }

  if (layer.outlineWidthPx > 0) {
    ctx.strokeStyle = layer.outlineColor;
    ctx.lineWidth = layer.outlineWidthPx;
    drawPass("stroke");
  }

  // Fill pass drawn without shadow duplication artifacts.
  ctx.shadowColor = "transparent";
  ctx.fillStyle = layer.color;
  drawPass("fill");

  ctx.restore();
}
