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

// ============================================================================
// Phase 3.3 §19/§20 — AIArtworkScore heuristics. Each function below is a
// real, fully-deterministic pixel measurement (no ML model, no OCR, no pose
// estimation — this sandbox has no way to load or run one). They are
// PROXIES for the categories the spec names, documented honestly as such at
// each call site in lib/expression-pipeline.ts's `scoreAiArtwork()` — never
// presented as true computer vision.
// ============================================================================

/**
 * Counts connected opaque regions on a small downsampled grid (4-connectivity
 * flood fill), ignoring regions smaller than `minAreaFraction` of the total
 * opaque area (anti-aliased fringe pixels/noise shouldn't count as a
 * separate "region"). A single character on a transparent background is 1
 * region; two well-separated large opaque blobs (e.g. two figures in frame,
 * or a figure plus a large disconnected prop) score 2+. This is a coarse
 * proxy for "how many distinct subjects" — it cannot tell a person from an
 * object, and two overlapping people register as 1 region. Documented as a
 * heuristic, not a person-detector.
 */
export function connectedOpaqueRegionCount(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  alphaThreshold = 16,
  minAreaFraction = 0.03
): number {
  const { data } = ctx.getImageData(0, 0, width, height);
  const opaque = new Uint8Array(width * height);
  let opaqueTotal = 0;
  for (let i = 0, p = 3; i < opaque.length; i++, p += 4) {
    if (data[p] > alphaThreshold) {
      opaque[i] = 1;
      opaqueTotal++;
    }
  }
  if (opaqueTotal === 0) return 0;

  const visited = new Uint8Array(width * height);
  const minArea = Math.max(4, Math.round(opaqueTotal * minAreaFraction));
  let regions = 0;
  const stack: number[] = [];

  for (let start = 0; start < opaque.length; start++) {
    if (!opaque[start] || visited[start]) continue;
    stack.length = 0;
    stack.push(start);
    visited[start] = 1;
    let area = 0;
    while (stack.length > 0) {
      const idx = stack.pop()!;
      area++;
      const x = idx % width;
      const y = (idx - x) / width;
      const neighbors = [
        x > 0 ? idx - 1 : -1,
        x < width - 1 ? idx + 1 : -1,
        y > 0 ? idx - width : -1,
        y < height - 1 ? idx + width : -1,
      ];
      for (const n of neighbors) {
        if (n >= 0 && opaque[n] && !visited[n]) {
          visited[n] = 1;
          stack.push(n);
        }
      }
    }
    if (area >= minArea) regions++;
  }
  return regions;
}

/** Average RGB of opaque-enough pixels only (background/transparent pixels
 * excluded), or `null` if there are none. Used as a coarse "dominant
 * subject color" fingerprint. */
export function averageOpaqueColor(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  alphaThreshold = 16
): [number, number, number] | null {
  const { data } = ctx.getImageData(0, 0, width, height);
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > alphaThreshold) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count++;
    }
  }
  if (count === 0) return null;
  return [r / count, g / count, b / count];
}

const MAX_RGB_DISTANCE = Math.sqrt(3 * 255 * 255);

/** Normalized (0-1) Euclidean distance between two average-color
 * fingerprints. 0 = identical average color, 1 = maximally different
 * (e.g. pure black vs. pure white). A COLOR-ONLY proxy for "does this still
 * look like the same character" — real identity (face shape, features)
 * can't be measured this way, which is why AIArtworkScore surfaces this as
 * `identityConsistency` with an explicit doc-comment about its limits
 * rather than claiming face-match confidence. */
export function dominantColorDistance(a: [number, number, number], b: [number, number, number]): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.min(1, Math.sqrt(dr * dr + dg * dg + db * db) / MAX_RGB_DISTANCE);
}

/**
 * Coarse, deliberately conservative proxy for "does this image contain
 * small AI-rendered text/letters/logos" (spec §19 "มี Text ที่ AI สร้างเองหรือไม่").
 * This is NOT OCR — there is no text-recognition model available offline.
 * It tiles the opaque bounding-box region into small patches and measures
 * local luminance variance per patch; rendered text tends to produce many
 * small patches with sharp, repeated high-contrast edges packed close
 * together (a "texture" signature different from smooth cartoon shading or
 * large solid fill regions). Returns the fraction of high-variance tiles,
 * 0-1. Biased toward FALSE NEGATIVES over false positives — the caller
 * treats this as one weighted signal among several, not a standalone
 * pass/fail, specifically so real artwork with fine detail (hair strands,
 * patterns) isn't wrongly rejected.
 */
export function textLikeEdgeDensity(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  tileSize = 8
): number {
  const { data } = ctx.getImageData(0, 0, width, height);
  const cols = Math.max(1, Math.floor(width / tileSize));
  const rows = Math.max(1, Math.floor(height / tileSize));
  let highVarianceTiles = 0;
  let sampledTiles = 0;

  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      let sum = 0;
      let sumSq = 0;
      let n = 0;
      let anyOpaque = false;
      for (let y = ty * tileSize; y < Math.min(height, ty * tileSize + tileSize); y++) {
        for (let x = tx * tileSize; x < Math.min(width, tx * tileSize + tileSize); x++) {
          const p = (y * width + x) * 4;
          const alpha = data[p + 3];
          if (alpha < 16) continue;
          anyOpaque = true;
          const luminance = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
          sum += luminance;
          sumSq += luminance * luminance;
          n++;
        }
      }
      if (!anyOpaque || n < tileSize) continue;
      sampledTiles++;
      const mean = sum / n;
      const variance = sumSq / n - mean * mean;
      // High-contrast small strokes (thin glyph edges) push variance well
      // above what smooth shading/fill regions typically show.
      if (variance > 3500) highVarianceTiles++;
    }
  }

  if (sampledTiles === 0) return 0;
  return highVarianceTiles / sampledTiles;
}
