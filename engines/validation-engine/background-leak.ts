import type { Rect } from "@/types";
import { get2dContext } from "@/lib/canvas-utils";

/** Anything above this alpha, outside the content box, counts as leaked
 * background rather than anti-aliasing noise. */
const LEAK_ALPHA_THRESHOLD = 10;

export interface BackgroundLeakResult {
  hasLeak: boolean;
  /** Highest alpha value (0-255) found anywhere it shouldn't be. */
  maxOutsideAlpha: number;
  cornersOk: boolean;
  edgesOk: boolean;
  outsideContentBoxOk: boolean;
}

/**
 * detectBackgroundLeak (Phase 1.2 §9) — a real pixel-level check for
 * leftover background, not just "does *some* transparent pixel exist
 * anywhere" (spec §8 explicitly calls that insufficient). Inspects:
 *   1. All 4 corners
 *   2. The full top/bottom/left/right edge (every pixel — the canvas is
 *      small, ≤370×320, so a full edge scan is cheap)
 *   3. Every pixel outside the content bounding box (from
 *      getStickerContentBounds via `contentBounds`)
 * Any opaque-enough pixel found in any of those regions is a leak.
 */
export function detectBackgroundLeak(canvas: HTMLCanvasElement, contentBounds: Rect | null): BackgroundLeakResult {
  const ctx = get2dContext(canvas);
  const { width: w, height: h, } = canvas;
  const { data } = ctx.getImageData(0, 0, w, h);
  const alphaAt = (x: number, y: number) => data[(y * w + x) * 4 + 3];

  let maxCornerAlpha = 0;
  for (const [x, y] of [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
  ]) {
    maxCornerAlpha = Math.max(maxCornerAlpha, alphaAt(x, y));
  }
  const cornersOk = maxCornerAlpha <= LEAK_ALPHA_THRESHOLD;

  let maxEdgeAlpha = 0;
  for (let x = 0; x < w; x++) {
    maxEdgeAlpha = Math.max(maxEdgeAlpha, alphaAt(x, 0), alphaAt(x, h - 1));
  }
  for (let y = 0; y < h; y++) {
    maxEdgeAlpha = Math.max(maxEdgeAlpha, alphaAt(0, y), alphaAt(w - 1, y));
  }
  const edgesOk = maxEdgeAlpha <= LEAK_ALPHA_THRESHOLD;

  let maxOutsideAlpha = Math.max(maxCornerAlpha, maxEdgeAlpha);
  if (contentBounds) {
    const { x: bx, y: by, width: bw, height: bh } = contentBounds;
    for (let y = 0; y < h; y++) {
      const insideRow = y >= by && y < by + bh;
      for (let x = 0; x < w; x++) {
        if (insideRow && x >= bx && x < bx + bw) continue; // inside content — not our concern here
        const a = alphaAt(x, y);
        if (a > maxOutsideAlpha) maxOutsideAlpha = a;
      }
    }
  }
  const outsideContentBoxOk = maxOutsideAlpha <= LEAK_ALPHA_THRESHOLD;

  return {
    hasLeak: !(cornersOk && edgesOk && outsideContentBoxOk),
    maxOutsideAlpha,
    cornersOk,
    edgesOk,
    outsideContentBoxOk,
  };
}
