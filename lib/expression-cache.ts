import type { ExpressionId, IntentId, PoseId, StyleId } from "@/types";
import type { ExpressionGenerationResult } from "@/providers/ai/types";

/**
 * Expression cache (spec Phase 2.5 §29/§30, extended Phase 3 §23) — keyed by
 * `characterHash:emotion:pose:style:provider:model:promptVersion`, so
 * re-generating the same sticker (e.g. after an unrelated composition/text
 * edit that happens to also trigger a re-render, or the user picking the
 * exact same {emotion,pose} for two different plan rows) never calls the AI
 * provider twice for identical inputs. Including `provider`, `model`, and
 * `promptVersion` (Phase 3 addition) matters for correctness, not just
 * cost: switching AI_PROVIDER, changing AI_MODEL, or editing the prompt
 * builder's wording must never silently serve an image generated under the
 * OLD configuration — each of those is a genuinely different request, so
 * each gets its own cache entry. Deliberately a plain in-memory Map, not
 * IndexedDB/localStorage: the cached value only ever contains image URLs +
 * provider name/model/timing metadata — never a secret (spec §29: "แต่ต้อง
 * ไม่เก็บ Secret") — and losing it on a full page reload just means the next
 * identical request regenerates once, which is an acceptable, safe default
 * for a cache with no correctness requirement to survive reloads.
 */
const cache = new Map<string, ExpressionGenerationResult>();

export interface ExpressionCacheKeyInput {
  characterHash: string;
  emotion: ExpressionId;
  pose: PoseId;
  style: StyleId;
  provider: string;
  model: string;
  promptVersion: string;
  /** Phase 3.3 §8 — optional Sticker Intent. Included in the key (when
   * present) because it changes the prompt's Action clause, so a request
   * with a different intent is a genuinely different request and must not
   * silently reuse a cached image generated for a different action. */
  intent?: IntentId;
}

export function buildExpressionCacheKey(input: ExpressionCacheKeyInput): string {
  const intentPart = input.intent ? `:${input.intent}` : "";
  return `${input.characterHash}:${input.emotion}:${input.pose}:${input.style}:${input.provider}:${input.model}:${input.promptVersion}${intentPart}`;
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
