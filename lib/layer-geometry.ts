import type { AnyLayer, Rect } from "@/types";
import { getTextLayerRect } from "@/engines/text-engine";
import { getDecorationRect } from "@/engines/decoration-engine";

/** Unified bounding-rect lookup so the editor can hit-test/drag/resize any
 * layer kind through one code path instead of three. */
export function getLayerRect(ctx: CanvasRenderingContext2D, layer: AnyLayer): Rect {
  if (layer.kind === "text") return getTextLayerRect(ctx, layer);
  if (layer.kind === "decoration") return getDecorationRect(layer);
  // character
  const w = layer.naturalWidth * layer.scale;
  const h = layer.naturalHeight * layer.scale;
  return { x: layer.x - w / 2, y: layer.y - h / 2, width: w, height: h };
}

export function pointInRect(px: number, py: number, r: Rect): boolean {
  return px >= r.x && px <= r.x + r.width && py >= r.y && py <= r.y + r.height;
}

export function rectHandle(r: Rect): { x: number; y: number } {
  return { x: r.x + r.width, y: r.y + r.height };
}

export function rectRotateHandle(r: Rect): { x: number; y: number } {
  return { x: r.x + r.width / 2, y: r.y - 26 };
}

export function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}
