import type { EmotionId, PackPresetId, PackSize, StickerPlanItem } from "@/types";
import { PACK_PRESETS } from "@/config/pack-presets";
import { EMOTION_PRESETS } from "@/styles/emotion-presets";
import { COMPOSITION_PRESETS, EMOTION_COMPOSITION_AFFINITY } from "@/config/composition-presets";
import { EMOTION_EXPRESSION_MAP, EMOTION_INTENT_MAP, resolveExpressionForOccurrence } from "@/config/expression-presets";

let idCounter = 0;
function nextPlanId(): string {
  idCounter += 1;
  return `plan-${idCounter}-${Date.now().toString(36)}`;
}

interface PoolItem {
  text: string;
  emotion: EmotionId;
}

function buildSourcePool(presetId: PackPresetId): PoolItem[] {
  const generalPool: PoolItem[] = EMOTION_PRESETS.filter((e) => e.id !== "custom").map((e) => ({
    text: e.defaultText,
    emotion: e.id,
  }));

  if (presetId === "custom") return generalPool;

  const presetPool = PACK_PRESETS[presetId].items.map((i) => ({ text: i.text, emotion: i.emotion }));
  // Preset phrases first (what the user picked), then the general emotion
  // list as filler so packs bigger than one preset's item count (9) still
  // get sensible, non-repetitive text before anything has to repeat.
  return [...presetPool, ...generalPool];
}

/**
 * Builds an editable Sticker Plan (spec §6/§7) for `size` stickers from a
 * preset (or the general emotion list for "custom"). Cycles through the
 * source pool to fill the requested size, and — critically — assigns each
 * occurrence of a given emotion a *different* composition preset from its
 * affinity list (spec §10: no two stickers should look composed the same
 * way), tracked per-emotion so even a 40-sticker pack with lots of repeats
 * still visibly varies.
 *
 * Phase 3.3 §6/§27: the exact same per-emotion `occurrence` counter now ALSO
 * drives `resolveExpressionForOccurrence` (config/expression-presets.ts),
 * so the Nth time an emotion repeats it gets a different {expression,pose}
 * pair too, not just a different composition. This directly fixes the
 * Phase 3.3 complaint that repeated emotions always rendered "the same
 * character in the same pose."
 */
export function buildStickerPlan(size: PackSize, presetId: PackPresetId): StickerPlanItem[] {
  const pool = buildSourcePool(presetId);
  const emotionCounters = new Map<EmotionId, number>();

  const plan: StickerPlanItem[] = [];
  for (let i = 0; i < size; i++) {
    const source = pool[i % pool.length];
    const affinity = EMOTION_COMPOSITION_AFFINITY[source.emotion] ?? EMOTION_COMPOSITION_AFFINITY.custom;
    const occurrence = emotionCounters.get(source.emotion) ?? 0;
    emotionCounters.set(source.emotion, occurrence + 1);
    const compositionPresetId = affinity[occurrence % affinity.length];
    const expr = resolveExpressionForOccurrence(source.emotion, occurrence);

    plan.push({
      id: nextPlanId(),
      order: i + 1,
      text: source.text,
      emotion: source.emotion,
      compositionPresetId,
      decorationDensity: COMPOSITION_PRESETS[compositionPresetId].decorationDensity,
      // Phase 2.5 — only consulted when the pack's useAiExpressions toggle is
      // on (spec §1: otherwise this is inert extra data, Phase 2 behavior
      // unchanged). Phase 3.3: now varies per-occurrence instead of being
      // fixed per-emotion (see resolveExpressionForOccurrence above).
      expression: expr.expression,
      pose: expr.pose,
      intent: EMOTION_INTENT_MAP[source.emotion],
    });
  }
  return plan;
}

/** Used by [Add Sticker] in the Plan Editor — a blank-ish row the user fills in. */
export function createBlankPlanItem(order: number): StickerPlanItem {
  const expr = EMOTION_EXPRESSION_MAP.custom;
  return {
    id: nextPlanId(),
    order,
    text: "",
    emotion: "custom",
    compositionPresetId: "CENTER_TOP_TEXT",
    decorationDensity: "normal",
    expression: expr.expression,
    pose: expr.pose,
  };
}

/** Used by [Duplicate]. */
export function duplicatePlanItem(item: StickerPlanItem, order: number): StickerPlanItem {
  return { ...item, id: nextPlanId(), order };
}
