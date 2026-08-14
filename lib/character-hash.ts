import { loadImage } from "./image-loader";
import { createCanvas, get2dContext } from "./canvas-utils";

const SAMPLE_SIZE = 32;

/** Draws `image` at a small, fixed resolution and returns its raw RGBA
 * bytes — the same cheap sampling step `character-master.ts` already used
 * for dominant-color extraction, now shared so a hash can be derived from
 * the exact same data without loading/drawing the image twice. */
export function sampleImagePixels(image: HTMLImageElement, size = SAMPLE_SIZE): Uint8ClampedArray {
  const canvas = createCanvas(size, size);
  const ctx = get2dContext(canvas);
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(image, 0, 0, size, size);
  return ctx.getImageData(0, 0, size, size).data;
}

/**
 * Deterministic FNV-1a hash over raw pixel bytes (spec §30/§31 — "Character
 * Reference Hash", "เปลี่ยนเมื่อ User Upload รูปใหม่"). Same image content
 * always produces the same hash; any different photo (even resized, since
 * sampling is fixed-resolution and content-derived, not dimension-derived
 * alone) produces a different one. Deliberately NOT cryptographic — this is
 * a cache key, not a security boundary, so a simple 32-bit rolling hash is
 * enough and keeps this dependency-free.
 */
export function hashPixelData(data: Uint8ClampedArray): string {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < data.length; i++) {
    hash ^= data[i];
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Convenience wrapper for callers that only have a URL, not an already-
 * loaded `HTMLImageElement` (e.g. the single-sticker flow, which has no
 * CharacterMaster of its own — spec §32 wants it to reuse this exact same
 * hashing logic rather than inventing a second implementation). */
export async function computeCharacterHash(imageUrl: string): Promise<string> {
  const image = await loadImage(imageUrl);
  return hashPixelData(sampleImagePixels(image));
}
