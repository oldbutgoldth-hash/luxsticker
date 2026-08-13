import type { Rect } from "@/types";
import { createCanvas, get2dContext } from "@/lib/canvas-utils";
import { getStickerContentBounds } from "@/lib/content-bounds";

export interface CropOutcome {
  canvas: HTMLCanvasElement;
  cropRect: Rect;
  hadContent: boolean;
}

/**
 * Generic auto-crop (spec Phase 1 §11): finds the bounding box of every
 * non-transparent pixel across the fully-composited canvas (character +
 * outline + text + decoration all get flattened onto one canvas before this
 * runs, so they're all included automatically) and crops tightly around it
 * with a small transparent padding margin. Never crops beyond the source
 * canvas, so content is never cut off.
 *
 * Kept as-is for anything that just wants "a tight crop" without a target
 * platform's size ceiling. Profile-bound exports (LINE, etc.) use
 * `cropAndFitToBounds` below instead.
 */
export function autoCropCanvas(
  source: HTMLCanvasElement,
  paddingRatio = 0.06,
  minPaddingPx = 20
): CropOutcome {
  const bbox = getStickerContentBounds(source);

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

export interface ProfileCropOptions {
  maxWidth: number;
  maxHeight: number;
  paddingPx: number;
  requireEvenDimensions: boolean;
}

export interface ProfileCropOutcome {
  canvas: HTMLCanvasElement;
  /** Content bounding box in the *source* canvas's coordinate space, before scaling. */
  sourceContentRect: Rect;
  /** Uniform scale factor applied to content (1 = no scale, <1 = shrunk to fit). */
  scale: number;
  hadContent: boolean;
}

/**
 * Profile-bound crop/fit (Phase 1.1 §3-§5). Unlike a naive
 * "crop-then-shrink-the-whole-canvas" approach, this computes the *content*
 * bounding box first, figures out the one uniform scale factor needed to
 * make the content plus a full `paddingPx` margin fit inside
 * maxWidth×maxHeight, and only then draws — so the padding is guaranteed to
 * survive at its full requested size even when heavy downscaling is
 * required (padding is added in *output* space, not scaled along with the
 * content). Content is only ever uniformly scaled (same factor for both
 * axes), never stretched, and never upscaled beyond its original size.
 */
export function cropAndFitToBounds(source: HTMLCanvasElement, options: ProfileCropOptions): ProfileCropOutcome {
  const { maxWidth, maxHeight, paddingPx, requireEvenDimensions } = options;
  const bbox = getStickerContentBounds(source);

  if (!bbox) {
    const w = requireEvenDimensions ? toEvenClamp(Math.min(2, maxWidth), maxWidth) : Math.min(2, maxWidth);
    const h = requireEvenDimensions ? toEvenClamp(Math.min(2, maxHeight), maxHeight) : Math.min(2, maxHeight);
    return {
      canvas: createCanvas(w, h),
      sourceContentRect: { x: 0, y: 0, width: 0, height: 0 },
      scale: 1,
      hadContent: false,
    };
  }

  // Room left for content once both padding margins are reserved.
  const availableWidth = Math.max(1, maxWidth - paddingPx * 2);
  const availableHeight = Math.max(1, maxHeight - paddingPx * 2);

  // One uniform factor — never stretches, never upscales past original size.
  const scale = Math.min(1, availableWidth / bbox.width, availableHeight / bbox.height);

  const scaledContentWidth = Math.max(1, Math.round(bbox.width * scale));
  const scaledContentHeight = Math.max(1, Math.round(bbox.height * scale));

  let finalWidth = Math.min(maxWidth, scaledContentWidth + paddingPx * 2);
  let finalHeight = Math.min(maxHeight, scaledContentHeight + paddingPx * 2);

  if (requireEvenDimensions) {
    finalWidth = toEvenClamp(finalWidth, maxWidth);
    finalHeight = toEvenClamp(finalHeight, maxHeight);
  }

  const out = createCanvas(finalWidth, finalHeight);
  const outCtx = get2dContext(out);
  const dx = (finalWidth - scaledContentWidth) / 2;
  const dy = (finalHeight - scaledContentHeight) / 2;
  outCtx.drawImage(
    source,
    bbox.x,
    bbox.y,
    bbox.width,
    bbox.height,
    dx,
    dy,
    scaledContentWidth,
    scaledContentHeight
  );

  return { canvas: out, sourceContentRect: bbox, scale, hadContent: true };
}

/** Rounds to the nearest even integer, rounding *down* instead of up if
 * rounding up would exceed `max` (so we never sneak over a hard ceiling
 * like LINE's 370×320 just to satisfy the even-dimension rule). */
export function toEvenClamp(value: number, max: number): number {
  let v = Math.round(value);
  if (v % 2 !== 0) {
    v = v + 1 <= max ? v + 1 : v - 1;
  }
  return Math.max(2, Math.min(v, max));
}
