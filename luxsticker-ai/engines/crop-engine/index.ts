import type { Rect } from "@/types";
import { alphaBoundingBox, createCanvas, get2dContext } from "@/lib/canvas-utils";

export interface CropOutcome {
  canvas: HTMLCanvasElement;
  cropRect: Rect;
  hadContent: boolean;
}

/**
 * Auto-crop (spec §11): finds the bounding box of every non-transparent
 * pixel across the fully-composited canvas (character + outline + text +
 * decoration all get flattened onto one canvas before this runs, so they're
 * all included automatically) and crops tightly around it with a small
 * transparent padding margin. Never crops beyond the source canvas, so
 * content is never cut off.
 */
export function autoCropCanvas(
  source: HTMLCanvasElement,
  paddingRatio = 0.06,
  minPaddingPx = 20
): CropOutcome {
  const ctx = get2dContext(source);
  const bbox = alphaBoundingBox(ctx, source.width, source.height, 8);

  if (!bbox) {
    return { canvas: source, cropRect: { x: 0, y: 0, width: source.width, height: source.height }, hadContent: false };
  }

  const padX = Math.max(minPaddingPx, bbox.width * paddingRatio);
  const padY = Math.max(minPaddingPx, bbox.height * paddingRatio);

  const x = Math.max(0, Math.floor(bbox.x - padX));
  const y = Math.max(0, Math.floor(bbox.y - padY));
  const maxX = Math.min(source.width, Math.ceil(bbox.x + bbox.width + padX));
  const maxY = Math.min(source.height, Math.ceil(bbox.y + bbox.height + padY));
  const width = Math.max(1, maxX - x);
  const height = Math.max(1, maxY - y);

  const out = createCanvas(width, height);
  const outCtx = get2dContext(out);
  outCtx.drawImage(source, x, y, width, height, 0, 0, width, height);

  return { canvas: out, cropRect: { x, y, width, height }, hadContent: true };
}
