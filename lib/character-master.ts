import type { CharacterLayer, CharacterMaster } from "@/types";
import { loadImage } from "./image-loader";
import { createCanvas, get2dContext, hexToRgb } from "./canvas-utils";

let idCounter = 0;
function nextMasterId(): string {
  idCounter += 1;
  return `master-${idCounter}-${Date.now().toString(36)}`;
}

/** Cheap, deterministic dominant-color sampling — draws the cutout at a tiny
 * resolution, buckets opaque pixels into quantized RGB bins, and returns the
 * most frequent few as hex strings. This is real pixel math, not an AI
 * attribute detector (spec §35: no fake AI) — it's just descriptive metadata
 * for the Character Master, e.g. to tint UI accents later. */
function sampleDominantColors(image: HTMLImageElement, maxColors = 5): string[] {
  const SAMPLE_SIZE = 32;
  const canvas = createCanvas(SAMPLE_SIZE, SAMPLE_SIZE);
  const ctx = get2dContext(canvas);
  ctx.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
  const QUANT = 32;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 128) continue; // skip transparent/background pixels
    const r = Math.round(data[i] / QUANT) * QUANT;
    const g = Math.round(data[i + 1] / QUANT) * QUANT;
    const b = Math.round(data[i + 2] / QUANT) * QUANT;
    const key = `${r},${g},${b}`;
    const existing = buckets.get(key);
    if (existing) existing.count += 1;
    else buckets.set(key, { count: 1, r, g, b });
  }

  return Array.from(buckets.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, maxColors)
    .map(({ r, g, b }) => rgbToHex(r, g, b));
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  return `#${[clamp(r), clamp(g), clamp(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Builds the Character Master (spec §4) from an already background-removed
 * CharacterLayer. Does NOT call the AI provider — background removal has
 * already happened once, upstream, in engines/background-remover. Every
 * sticker in the pack will reuse `cutoutUrl` from the returned master
 * as-is (spec §5/§15: identity consistency + no repeat AI calls).
 */
export async function buildCharacterMaster(character: CharacterLayer): Promise<CharacterMaster> {
  const image = await loadImage(character.cutoutUrl);
  const dominantColors = sampleDominantColors(image);
  return {
    id: nextMasterId(),
    originalUrl: character.originalUrl,
    cutoutUrl: character.cutoutUrl,
    naturalWidth: character.naturalWidth,
    naturalHeight: character.naturalHeight,
    isFallbackCutout: character.isFallbackCutout,
    dominantColors,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Builds a fresh CharacterLayer for one sticker from the shared master —
 * same cutout image, new transform. This is the mechanism that keeps every
 * sticker in the pack visually the same person: they all point at the exact
 * same `cutoutUrl`, never a re-generated or re-cut image.
 */
export function characterLayerFromMaster(
  master: CharacterMaster,
  transform: { x: number; y: number; scale: number; rotation: number }
): CharacterLayer {
  return {
    id: "character",
    kind: "character",
    ...transform,
    zIndex: 10,
    originalUrl: master.originalUrl,
    cutoutUrl: master.cutoutUrl,
    naturalWidth: master.naturalWidth,
    naturalHeight: master.naturalHeight,
    isFallbackCutout: master.isFallbackCutout,
  };
}

// Re-exported so callers that only need color math don't have to reach into
// canvas-utils directly.
export { hexToRgb };
