import type { StickerProject } from "@/types";
import { loadImage } from "./image-loader";
import { createCanvas, get2dContext, alphaBoundingBox } from "./canvas-utils";
import { drawImageCentered } from "./layer-draw";
import { generateOutlineCanvas } from "@/engines/outline-engine";
import { drawTextLayer } from "@/engines/text-engine";
import { drawDecorationLayer } from "@/engines/decoration-engine";

export interface WorkingRender {
  canvas: HTMLCanvasElement;
  /** True if opaque content is touching the working-canvas edge — a sign
   * something is at risk of being clipped before auto-crop runs. */
  clipped: boolean;
}

/**
 * Draws the current project state (whatever the layer positions happen to
 * be — auto-composed or user-edited) onto one flattened canvas, in the
 * fixed stacking order: outline → character → decorations → text. This is
 * the single function both the live editor preview and the final export
 * pipeline render through, so what the user edits is exactly what they get.
 */
export async function renderWorkingCanvas(project: StickerProject): Promise<WorkingRender> {
  const { canvasSize, character, text, decorations, outline } = project;
  const canvas = createCanvas(canvasSize.width, canvasSize.height);
  const ctx = get2dContext(canvas);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (character) {
    const img = await loadImage(character.cutoutUrl);
    const outlineCanvas = generateOutlineCanvas(canvasSize.width, canvasSize.height, img, character, outline);
    ctx.drawImage(outlineCanvas, 0, 0);
    drawImageCentered(ctx, img, character.naturalWidth, character.naturalHeight, character);
  }

  for (const deco of [...decorations].sort((a, b) => a.zIndex - b.zIndex)) {
    drawDecorationLayer(ctx, deco);
  }

  if (text) {
    drawTextLayer(ctx, text);
  }

  const bbox = alphaBoundingBox(ctx, canvas.width, canvas.height, 8);
  const margin = 2;
  const clipped =
    !!bbox &&
    (bbox.x <= margin ||
      bbox.y <= margin ||
      bbox.x + bbox.width >= canvas.width - margin ||
      bbox.y + bbox.height >= canvas.height - margin);

  return { canvas, clipped };
}

/** A disposable 2D context used purely for text-metric measurement (font
 * metrics don't depend on the context actually being visible on screen). */
export function measurementContext(): CanvasRenderingContext2D {
  return get2dContext(createCanvas(64, 64));
}
