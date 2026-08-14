import type { EmotionId, TextCompositionVariant } from "@/types";

/**
 * Text placement/treatment variety (Phase 3.1 spec §14) — picks between the
 * 8 `TextCompositionVariant`s per emotion, cycling like
 * `EMOTION_COMPOSITION_AFFINITY` (config/composition-presets.ts) and
 * `EMOTION_DECORATION_GLYPHS` already do, so a big pack doesn't put text in
 * the same spot/treatment on every sticker even when the same emotion
 * repeats (spec §10/§19).
 *
 * `large_top` / `large_left` / `large_right` / `bottom` / `diagonal` are
 * placement SEEDS the existing composition engine already knows how to
 * realize — autoCompose() (engines/composition-engine) positions text
 * opposite the character and the character-position composition presets
 * (config/composition-presets.ts) already produce top/left/right/bottom/
 * diagonal placements. `curved`, `stacked`, and `mixed` are genuinely new
 * render treatments (engines/text-engine's drawTextLayer) layered on top of
 * whatever position autoCompose lands on.
 */
export const TEXT_COMPOSITION_AFFINITY: Record<EmotionId, TextCompositionVariant[]> = {
  sawadee: ["large_top", "curved", "large_left"],
  thankyou: ["bottom", "curved", "large_right"],
  ok: ["large_top", "bottom"],
  love: ["curved", "stacked", "bottom"],
  miss: ["curved", "large_top"],
  haha: ["stacked", "diagonal", "mixed"],
  happy: ["large_top", "stacked", "diagonal"],
  shy: ["large_right", "bottom"],
  sulk: ["diagonal", "large_left"],
  angry: ["diagonal", "stacked", "mixed"],
  cry: ["bottom", "large_right"],
  hungry: ["large_top", "diagonal"],
  sleepy: ["bottom", "large_left"],
  tired: ["bottom", "large_left"],
  fight: ["diagonal", "stacked", "large_top"],
  goodnight: ["curved", "bottom"],
  custom: ["large_top", "bottom", "large_left", "large_right"],
};

/**
 * Resolves the variant for one plan item: an explicit override always wins;
 * otherwise cycles through that emotion's affinity list by how many times
 * this emotion has already occurred earlier in the plan (same "occurrence
 * counter" pattern plan-builder.ts already uses for composition presets),
 * so repeats of the same emotion still visibly vary.
 */
export function resolveTextComposition(
  emotion: EmotionId,
  occurrence: number,
  override?: TextCompositionVariant
): TextCompositionVariant {
  if (override) return override;
  const pool = TEXT_COMPOSITION_AFFINITY[emotion] ?? TEXT_COMPOSITION_AFFINITY.custom;
  return pool[occurrence % pool.length];
}
