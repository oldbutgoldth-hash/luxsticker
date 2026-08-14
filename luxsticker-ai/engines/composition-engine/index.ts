import type { CanvasSize, CharacterLayer, Rect, TextLayer } from "@/types";
import { createCanvas, get2dContext, alphaBoundingBox, expandRect, rectsIntersect } from "@/lib/canvas-utils";
import { drawImageCentered } from "@/lib/layer-draw";
import { getTextLayerRect, measureTextLayerLocal } from "@/engines/text-engine";

const MAX_CHARACTER_AREA_RATIO = 0.62;
const TARGET_CHARACTER_AREA_RATIO = 0.5;
const TEXT_SHRINK_STEPS = 4;

export interface ComposeResult {
  character: CharacterLayer;
  characterRect: Rect;
  text: TextLayer;
  textRect: Rect;
}

function computeCharacterRect(
  canvasSize: CanvasSize,
  image: CanvasImageSource,
  character: CharacterLayer
): Rect {
  const canvas = createCanvas(canvasSize.width, canvasSize.height);
  const ctx = get2dContext(canvas);
  drawImageCentered(ctx, image, character.naturalWidth, character.naturalHeight, character);
  const bbox = alphaBoundingBox(ctx, canvasSize.width, canvasSize.height);
  if (bbox) return bbox;
  // Fallback: nothing above the alpha threshold (e.g. fallback cutout with
  // no transparency) — approximate with the drawn image's own box.
  const w = character.naturalWidth * character.scale;
  const h = character.naturalHeight * character.scale;
  return { x: character.x - w / 2, y: character.y - h / 2, width: w, height: h };
}

/**
 * Auto-composition (spec §10): keeps the face/hands/body clear, places text
 * opposite the character, shrinks an oversized character, and hands back
 * bounding rects the decoration engine uses to avoid collisions.
 */
export function autoCompose(
  ctx: CanvasRenderingContext2D,
  canvasSize: CanvasSize,
  characterImage: CanvasImageSource,
  characterIn: CharacterLayer,
  textIn: TextLayer
): ComposeResult {
  let character = { ...characterIn };
  let characterRect = computeCharacterRect(canvasSize, characterImage, character);

  const canvasArea = canvasSize.width * canvasSize.height;
  const areaRatio = (characterRect.width * characterRect.height) / canvasArea;
  if (areaRatio > MAX_CHARACTER_AREA_RATIO) {
    const shrinkFactor = Math.sqrt(TARGET_CHARACTER_AREA_RATIO / areaRatio);
    character = {
      ...character,
      scale: character.scale * shrinkFactor,
      x: canvasSize.width / 2,
      y: canvasSize.height * 0.56,
    };
    characterRect = computeCharacterRect(canvasSize, characterImage, character);
  }

  const bboxCenterXFrac = (characterRect.x + characterRect.width / 2) / canvasSize.width;
  const spaceAbove = characterRect.y;
  const spaceBelow = canvasSize.height - (characterRect.y + characterRect.height);

  let textX: number;
  let textY: number;
  if (bboxCenterXFrac < 0.42) {
    textX = canvasSize.width * 0.74;
    textY = canvasSize.height * 0.24;
  } else if (bboxCenterXFrac > 0.58) {
    textX = canvasSize.width * 0.26;
    textY = canvasSize.height * 0.24;
  } else if (spaceAbove >= spaceBelow) {
    textX = canvasSize.width * 0.5;
    textY = canvasSize.height * 0.15;
  } else {
    textX = canvasSize.width * 0.5;
    textY = canvasSize.height * 0.88;
  }

  let text: TextLayer = { ...textIn, x: textX, y: textY };
  let textRect = getTextLayerRect(ctx, text);

  // If the text still overlaps the character bbox (extreme aspect ratios),
  // progressively shrink the font until it clears, then give up gracefully
  // — Validation will catch any remaining edge case.
  let attempts = 0;
  while (rectsIntersect(expandRect(characterRect, 6), textRect) && attempts < TEXT_SHRINK_STEPS) {
    text = { ...text, fontSizePx: Math.round(text.fontSizePx * 0.88) };
    textRect = getTextLayerRect(ctx, text);
    attempts++;
  }

  // Keep text fully inside the canvas.
  const clampedX = Math.min(Math.max(text.x, textRect.width / 2 + 8), canvasSize.width - textRect.width / 2 - 8);
  const clampedY = Math.min(Math.max(text.y, textRect.height / 2 + 8), canvasSize.height - textRect.height / 2 - 8);
  text = { ...text, x: clampedX, y: clampedY };
  textRect = getTextLayerRect(ctx, text);

  return { character, characterRect, text, textRect };
}

export { measureTextLayerLocal };
