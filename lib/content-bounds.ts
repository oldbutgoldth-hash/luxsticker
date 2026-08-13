import type { Rect } from "@/types";
import { alphaBoundingBox, get2dContext } from "@/lib/canvas-utils";

/**
 * Single Source of Truth for "where is the sticker's content" (Phase 1.2
 * §11). Crop, padding checks, transparency/leak validation, preview info,
 * and export all call THIS function instead of each reaching for
 * `alphaBoundingBox` with their own threshold — so they can never quietly
 * disagree about what counts as "content" versus "background".
 */
export const CONTENT_ALPHA_THRESHOLD = 8;

/**
 * Returns the tight bounding box of every pixel more opaque than
 * CONTENT_ALPHA_THRESHOLD on `canvas` (character + outline + text +
 * decoration, whatever has been flattened onto it), or `null` if the canvas
 * is fully transparent.
 */
export function getStickerContentBounds(canvas: HTMLCanvasElement): Rect | null {
  const ctx = get2dContext(canvas);
  return alphaBoundingBox(ctx, canvas.width, canvas.height, CONTENT_ALPHA_THRESHOLD);
}
