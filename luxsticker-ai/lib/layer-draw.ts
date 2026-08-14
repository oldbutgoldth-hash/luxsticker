import type { LayerTransform } from "@/types";

/** Draws `image` centered at `transform.{x,y}`, scaled/rotated around its
 * own center. Shared by the outline engine and the main compositor so the
 * outline mask is always pixel-aligned with what actually gets rendered. */
export function drawImageCentered(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  naturalWidth: number,
  naturalHeight: number,
  transform: LayerTransform
) {
  ctx.save();
  ctx.translate(transform.x, transform.y);
  ctx.rotate(transform.rotation);
  ctx.scale(transform.scale, transform.scale);
  ctx.drawImage(image, -naturalWidth / 2, -naturalHeight / 2, naturalWidth, naturalHeight);
  ctx.restore();
}
