import type { ExpressionId, PoseId, StyleId } from "@/types";
import type { ExpressionGenerationResult } from "@/providers/ai/types";

/**
 * Expression cache (spec §29/§30) — keyed by
 * `characterHash:emotion:pose:style`, so re-generating the same sticker
 * (e.g. after an unrelated composition/text edit that happens to also
 * trigger a re-render, or the user picking the exact same {emotion,pose}
 * for two different plan rows) never calls the AI provider twice for
 * identical inputs. Deliberately a plain in-memory Map, not IndexedDB/
 * localStorage: the cached value only ever contains image URLs + provider
 * name/model/timing metadata — never a secret (spec §29: "แต่ต้องไม่เก็บ
 * Secret") — and losing it on a full page reload just means the next
 * identical request regenerates once, which is an acceptable, safe default
 * for a cache with no correctness requirement to survive reloads.
 */
const cache = new Map<string, ExpressionGenerationResult>();

export interface ExpressionCacheKeyInput {
  characterHash: string;
  emotion: ExpressionId;
  pose: PoseId;
  style: StyleId;
}

export function buildExpressionCacheKey(input: ExpressionCacheKeyInput): string {
  return `${input.characterHash}:${input.emotion}:${input.pose}:${input.style}`;
}

export function getCachedExpression(key: string): ExpressionGenerationResult | undefined {
  return cache.get(key);
}

export function setCachedExpression(key: string, result: ExpressionGenerationResult): void {
  cache.set(key, result);
}

export function clearExpressionCache(): void {
  cache.clear();
}

/** Exposed for tests / debugging only. */
export function expressionCacheSize(): number {
  return cache.size;
}
