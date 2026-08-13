import type { Rect } from "@/types";

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(width));
  c.height = Math.max(1, Math.round(height));
  return c;
}

export function get2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context is not available in this environment.");
  return ctx;
}

/** Alpha-channel bounding box of all non-transparent pixels (threshold-based). */
export function alphaBoundingBox(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  alphaThreshold = 8
): Rect | null {
  const { data } = ctx.getImageData(0, 0, width, height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width * 4;
    for (let x = 0; x < width; x++) {
      const alpha = data[rowOffset + x * 4 + 3];
      if (alpha > alphaThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * Binary alpha mask (1 = opaque-enough, 0 = transparent) extracted from a
 * canvas' current pixels. Used by the outline engine as the seed shape for
 * dilation, and reused by validation for transparency checks.
 */
export function extractAlphaMask(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  alphaThreshold = 20
): Uint8Array {
  const { data } = ctx.getImageData(0, 0, width, height);
  const mask = new Uint8Array(width * height);
  for (let i = 0, p = 3; i < mask.length; i++, p += 4) {
    mask[i] = data[p] > alphaThreshold ? 1 : 0;
  }
  return mask;
}

/**
 * Morphological dilation of a binary mask by `radius` px, approximated as a
 * diamond/octagon by alternating passes (fast, allocation-light, good
 * enough for a soft sticker outline — a true circular structuring element
 * is not worth the extra cost here).
 */
export function dilateMask(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  let current = mask;
  const steps = Math.max(0, Math.round(radius));
  for (let s = 0; s < steps; s++) {
    const next = new Uint8Array(current.length);
    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        const idx = row + x;
        if (current[idx]) {
          next[idx] = 1;
          continue;
        }
        const left = x > 0 && current[idx - 1];
        const right = x < width - 1 && current[idx + 1];
        const up = y > 0 && current[idx - width];
        const down = y < height - 1 && current[idx + width];
        next[idx] = left || right || up || down ? 1 : 0;
      }
    }
    current = next;
  }
  return current;
}

/** Paints `mask` onto a new same-size canvas using a solid color, alpha
 * following `opacity` (0-1). Used to render outline rings. */
export function maskToCanvas(
  mask: Uint8Array,
  width: number,
  height: number,
  color: string,
  opacity = 1
): HTMLCanvasElement {
  const canvas = createCanvas(width, height);
  const ctx = get2dContext(canvas);
  const imageData = ctx.createImageData(width, height);
  const [r, g, b] = hexToRgb(color);
  for (let i = 0, p = 0; i < mask.length; i++, p += 4) {
    if (mask[i]) {
      imageData.data[p] = r;
      imageData.data[p + 1] = g;
      imageData.data[p + 2] = b;
      imageData.data[p + 3] = Math.round(255 * opacity);
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const bigint = parseInt(
    clean.length === 3
      ? clean.split("").map((c) => c + c).join("")
      : clean,
    16
  );
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function expandRect(r: Rect, margin: number): Rect {
  return { x: r.x - margin, y: r.y - margin, width: r.width + margin * 2, height: r.height + margin * 2 };
}

export function rectCenter(r: Rect): { x: number; y: number } {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}
