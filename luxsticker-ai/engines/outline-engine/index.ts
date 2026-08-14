import type { CharacterLayer, OutlineConfig } from "@/types";
import { createCanvas, get2dContext, extractAlphaMask, dilateMask, maskToCanvas } from "@/lib/canvas-utils";
import { drawImageCentered } from "@/lib/layer-draw";

/**
 * Generates a full-canvas outline layer that traces the *actual shape* of
 * the character cutout (spec §8: "Outline ต้องติดตามรูปร่าง Subject ไม่ใช่
 * แค่ใส่ Stroke รอบสี่เหลี่ยม"). Implementation: rasterize the character at
 * its current transform, extract a binary alpha mask, morphologically
 * dilate it by the outline width, then paint the dilated ring with the
 * configured color(s). The result is meant to be drawn *behind* the
 * character layer so only the ring is visible.
 */
export function generateOutlineCanvas(
  canvasWidth: number,
  canvasHeight: number,
  characterImage: CanvasImageSource,
  character: CharacterLayer,
  config: OutlineConfig
): HTMLCanvasElement {
  const shapeCanvas = createCanvas(canvasWidth, canvasHeight);
  const shapeCtx = get2dContext(shapeCanvas);
  drawImageCentered(shapeCtx, characterImage, character.naturalWidth, character.naturalHeight, character);
  const baseMask = extractAlphaMask(shapeCtx, canvasWidth, canvasHeight, 20);

  const result = createCanvas(canvasWidth, canvasHeight);
  const resultCtx = get2dContext(result);

  const colorFor = (style: OutlineConfig["style"]): string => {
    switch (style) {
      case "black":
        return "#111111";
      case "white":
      case "soft-white":
      case "thick":
      default:
        return "#ffffff";
    }
  };

  if (config.style === "double") {
    const outer = dilateMask(baseMask, canvasWidth, canvasHeight, config.widthPx);
    const inner = dilateMask(baseMask, canvasWidth, canvasHeight, Math.max(1, config.widthPx * 0.55));
    const outerCanvas = maskToCanvas(outer, canvasWidth, canvasHeight, config.secondaryColor ?? "#ff9ec9", 1);
    const innerCanvas = maskToCanvas(inner, canvasWidth, canvasHeight, "#ffffff", 1);
    resultCtx.drawImage(outerCanvas, 0, 0);
    resultCtx.drawImage(innerCanvas, 0, 0);
    return result;
  }

  if (config.style === "soft-white") {
    const dilated = dilateMask(baseMask, canvasWidth, canvasHeight, config.widthPx);
    const ringCanvas = maskToCanvas(dilated, canvasWidth, canvasHeight, "#ffffff", 0.92);
    // Soft, feathered edge: blur the ring only (not the character on top of it).
    resultCtx.filter = "blur(3px)";
    resultCtx.drawImage(ringCanvas, 0, 0);
    resultCtx.filter = "none";
    return result;
  }

  const width = config.style === "thick" ? Math.max(config.widthPx, 18) : config.widthPx;
  const dilated = dilateMask(baseMask, canvasWidth, canvasHeight, width);
  const ringCanvas = maskToCanvas(dilated, canvasWidth, canvasHeight, colorFor(config.style), 1);
  resultCtx.drawImage(ringCanvas, 0, 0);
  return result;
}
