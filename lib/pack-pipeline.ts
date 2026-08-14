import type {
  AiGenerationStatus,
  CharacterMaster,
  CharacterMode,
  CharacterSource,
  ExpressionGenerationMetadata,
  ExpressionId,
  PackStickerItem,
  PoseId,
  StickerPlanItem,
  StickerProject,
  StyleId,
} from "@/types";
import { characterLayerFromMaster } from "./character-master";
import { buildTextLayer, CANVAS_SIZE, nextId } from "./project-factory";
import { COMPOSITION_PRESETS, DECORATION_DENSITY_COUNT, EMOTION_DECORATION_GLYPHS } from "@/config/composition-presets";
import { runGenerationPipeline, refreshAfterEdit, type GenerationOutcome } from "./pipeline";
import { STYLE_PRESETS } from "@/styles/style-presets";
import { DEFAULT_EXPORT_PROFILE, type ExportProfile } from "@/config/export-profiles";
import type { DecorationOverrides } from "@/engines/decoration-engine";
import { generateCharacterExpression } from "./expression-pipeline";

export function packStickerFilename(order: number): string {
  return `sticker_${String(order).padStart(2, "0")}.png`;
}

/**
 * Render Pipeline step "Create Layers -> Apply Composition" (spec §16):
 * seeds a StickerProject's character transform from the plan item's
 * composition preset, and its text from the plan item's phrase. Everything
 * character-related still points at the SAME `master.cutoutUrl` — no new
 * background removal, no re-generated person (spec §5).
 */
export function buildProjectForPlanItem(
  master: CharacterMaster,
  planItem: StickerPlanItem,
  packStyle: StyleId,
  canvasSize = CANVAS_SIZE,
  /** Phase 2.5 hook: when set, the character layer is built from this
   * source (an AI-generated expression, or an explicit fallback) instead of
   * `master` directly. Omitted by every Phase 2 call site, so pack rendering
   * with AI Expressions off is byte-for-byte unchanged. */
  characterSource?: CharacterSource
): StickerProject {
  const style = planItem.styleOverride ?? packStyle;
  const preset = COMPOSITION_PRESETS[planItem.compositionPresetId];
  const stylePreset = STYLE_PRESETS[style];
  const source = characterSource ?? master;

  // Same "fit to ~70% of the canvas's shorter side" rule the single-sticker
  // flow uses (engines/background-remover), then the preset's own multiplier.
  const targetSpan = Math.min(canvasSize.width, canvasSize.height) * 0.7;
  const longerSide = Math.max(source.naturalWidth, source.naturalHeight);
  const baseScale = longerSide > 0 ? targetSpan / longerSide : 1;

  const character = characterLayerFromMaster(source, {
    x: preset.characterXFraction * canvasSize.width,
    y: preset.characterYFraction * canvasSize.height,
    scale: baseScale * preset.characterScaleMultiplier,
    rotation: preset.rotation,
  });

  const text = buildTextLayer(style, planItem.emotion, planItem.text);
  text.fontSizePx = Math.round(text.fontSizePx * preset.textSizeMultiplier);
  text.rotation = preset.rotation;

  return {
    id: nextId("pack-project"),
    style,
    emotion: planItem.emotion,
    character,
    text,
    decorations: [],
    outline: { ...stylePreset.outline },
    canvasSize,
  };
}

/** Resolves the plan item's decoration density + the richer per-emotion
 * glyph palette (spec §12) into the options generateDecorations() accepts. */
export function decorationOverridesForPlanItem(planItem: StickerPlanItem): DecorationOverrides {
  return {
    maxCount: DECORATION_DENSITY_COUNT[planItem.decorationDensity],
    glyphPool: EMOTION_DECORATION_GLYPHS[planItem.emotion],
  };
}

/**
 * Renders ONE pack sticker end to end (spec §16: Character Master -> Create
 * Layers -> Composition -> Text -> Outline -> Decoration -> Render -> Auto
 * Crop -> Normalize -> Validate) by delegating to the exact same
 * `runGenerationPipeline` the single-sticker flow uses (lib/pipeline.ts,
 * unmodified in behavior when no decorationOverrides are passed). No AI
 * call happens here — background removal already ran once, on the master.
 */
export async function renderPackSticker(
  master: CharacterMaster,
  planItem: StickerPlanItem,
  packStyle: StyleId,
  canvasSize: { width: number; height: number } = CANVAS_SIZE,
  profile: ExportProfile = DEFAULT_EXPORT_PROFILE,
  characterSource?: CharacterSource
): Promise<GenerationOutcome> {
  const project = buildProjectForPlanItem(master, planItem, packStyle, canvasSize, characterSource);
  return runGenerationPipeline(project, profile, decorationOverridesForPlanItem(planItem));
}

export interface AiRenderInfo {
  aiStatus?: AiGenerationStatus;
  aiError?: string;
  aiMetadata?: ExpressionGenerationMetadata;
  characterMode?: CharacterMode;
}

export function toPackStickerItem(
  planItem: StickerPlanItem,
  outcome: GenerationOutcome,
  ai?: AiRenderInfo
): PackStickerItem {
  // A provider failure blocks Export (spec §17: status "needs_ai") even if
  // the fallback-rendered geometry itself would otherwise validate fine —
  // the user must explicitly Retry or accept "Use Original Character"
  // before this sticker can count as ready.
  const status = ai?.aiStatus === "AI_FAILED" ? "needs_ai" : outcome.validation.passed ? "ready" : "needs_fix";
  return {
    id: nextId("sticker"),
    planItemId: planItem.id,
    order: planItem.order,
    filename: packStickerFilename(planItem.order),
    project: outcome.project,
    finalCanvas: outcome.finalCanvas,
    validation: outcome.validation,
    status,
    attempts: 1,
    aiStatus: ai?.aiStatus,
    aiError: ai?.aiError,
    aiMetadata: ai?.aiMetadata,
    characterMode: ai?.characterMode,
  };
}

/**
 * renderPackStickerWithAI (spec §16/§32) — the AI-aware entry point both
 * batch generation and single-sticker Regenerate use. When `useAiExpressions`
 * is off, or the plan item has no {expression, pose} set, this is IDENTICAL
 * to calling `renderPackSticker` directly (spec §1: Phase 2 behavior
 * unchanged). When on, it first calls the shared `generateCharacterExpression`
 * engine, then renders using whatever character source that produced
 * (AI result, or the original Character Master on failure — spec §17).
 */
export async function renderPackStickerWithAI(
  master: CharacterMaster,
  planItem: StickerPlanItem,
  packStyle: StyleId,
  useAiExpressions: boolean,
  providerName: string,
  canvasSize: { width: number; height: number } = CANVAS_SIZE,
  profile: ExportProfile = DEFAULT_EXPORT_PROFILE
): Promise<{ outcome: GenerationOutcome; ai?: AiRenderInfo }> {
  if (!useAiExpressions || !planItem.expression || !planItem.pose) {
    const outcome = await renderPackSticker(master, planItem, packStyle, canvasSize, profile);
    return { outcome };
  }

  const expr = await generateCharacterExpression(
    { ...master },
    planItem.expression,
    planItem.pose,
    planItem.styleOverride ?? packStyle,
    providerName
  );
  const outcome = await renderPackSticker(master, planItem, packStyle, canvasSize, profile, expr.source);
  return {
    outcome,
    ai: {
      aiStatus: expr.aiStatus,
      aiError: expr.aiError,
      aiMetadata: expr.aiMetadata,
      characterMode: expr.characterMode,
    },
  };
}

/**
 * Batch Generation (spec §15) — a sequential queue, not parallel: keeps
 * memory bounded (one working canvas alive at a time even for a 40-pack)
 * and lets the caller report real per-item progress. Background removal for
 * the Character Master must already have happened before this is called —
 * this function never touches the AI provider.
 */
export async function generatePackStickers(
  master: CharacterMaster,
  plan: StickerPlanItem[],
  packStyle: StyleId,
  onProgress?: (done: number, total: number, stage: string) => void
): Promise<PackStickerItem[]> {
  const items: PackStickerItem[] = [];
  for (let i = 0; i < plan.length; i++) {
    const planItem = plan[i];
    onProgress?.(i, plan.length, `กำลังสร้างสติ๊กเกอร์ #${planItem.order}`);
    try {
      const outcome = await renderPackSticker(master, planItem, packStyle);
      items.push(toPackStickerItem(planItem, outcome));
    } catch (err) {
      console.error(`[pack-pipeline] sticker #${planItem.order} failed:`, err);
      items.push({
        id: nextId("sticker"),
        planItemId: planItem.id,
        order: planItem.order,
        filename: packStickerFilename(planItem.order),
        project: null,
        finalCanvas: null,
        validation: null,
        status: "error",
        attempts: 1,
      });
    }
    onProgress?.(i + 1, plan.length, `เสร็จแล้ว ${i + 1}/${plan.length}`);
  }
  return items;
}

/**
 * generatePackStickersWithAI (spec §16/§17/§32) — same sequential-queue
 * shape as `generatePackStickers`, plus the AI Expression step per item.
 * When `useAiExpressions` is false this produces byte-identical results to
 * `generatePackStickers` (each item just carries `ai: undefined` through to
 * `toPackStickerItem`, which leaves the Phase 2 status logic untouched).
 * One sticker's AI failure never stops the loop (spec §17) — it's caught
 * inside `renderPackStickerWithAI`/`generateCharacterExpression`, never
 * thrown out of this function.
 */
export async function generatePackStickersWithAI(
  master: CharacterMaster,
  plan: StickerPlanItem[],
  packStyle: StyleId,
  useAiExpressions: boolean,
  providerName: string,
  onProgress?: (done: number, total: number, stage: string, current?: { text: string; expression?: ExpressionId; pose?: PoseId }) => void
): Promise<PackStickerItem[]> {
  const items: PackStickerItem[] = [];
  for (let i = 0; i < plan.length; i++) {
    const planItem = plan[i];
    onProgress?.(i, plan.length, `กำลังสร้างสติ๊กเกอร์ #${planItem.order}`, {
      text: planItem.text,
      expression: planItem.expression,
      pose: planItem.pose,
    });
    try {
      const { outcome, ai } = await renderPackStickerWithAI(master, planItem, packStyle, useAiExpressions, providerName);
      items.push(toPackStickerItem(planItem, outcome, ai));
    } catch (err) {
      console.error(`[pack-pipeline] sticker #${planItem.order} failed:`, err);
      items.push({
        id: nextId("sticker"),
        planItemId: planItem.id,
        order: planItem.order,
        filename: packStickerFilename(planItem.order),
        project: null,
        finalCanvas: null,
        validation: null,
        status: "error",
        attempts: 1,
      });
    }
    onProgress?.(i + 1, plan.length, `เสร็จแล้ว ${i + 1}/${plan.length}`);
  }
  return items;
}

/**
 * Regenerates exactly one sticker (spec §17 failure handling / §21
 * "ห้าม Generate ทั้ง Pack ใหม่") — re-runs the same plan item through the
 * full pipeline again, a fresh attempt with the same composition preset.
 */
export async function regeneratePackSticker(
  master: CharacterMaster,
  planItem: StickerPlanItem,
  packStyle: StyleId,
  previous: PackStickerItem
): Promise<PackStickerItem> {
  const outcome = await renderPackSticker(master, planItem, packStyle);
  return {
    ...toPackStickerItem(planItem, outcome),
    id: previous.id,
    attempts: previous.attempts + 1,
  };
}

/**
 * Regenerates exactly one sticker THROUGH THE AI ENGINE (spec §20: Retry
 * button on a single "needs_ai" sticker) — never re-runs the whole pack.
 * Bypasses the expression cache implicitly only in the sense that a truly
 * identical {characterHash, expression, pose, style} would still cache-hit
 * (spec §29 — that's intentional, not a bug: retrying with unchanged inputs
 * after a transient network failure should succeed without a second real
 * charge once the provider is healthy again, since a cache hit only ever
 * happens after a PRIOR success, never after a failure — failures are never
 * written to the cache).
 */
export async function regeneratePackStickerWithAI(
  master: CharacterMaster,
  planItem: StickerPlanItem,
  packStyle: StyleId,
  useAiExpressions: boolean,
  providerName: string,
  previous: PackStickerItem
): Promise<PackStickerItem> {
  const { outcome, ai } = await renderPackStickerWithAI(master, planItem, packStyle, useAiExpressions, providerName);
  return {
    ...toPackStickerItem(planItem, outcome, ai),
    id: previous.id,
    attempts: previous.attempts + 1,
  };
}

/**
 * "Use Original Character" (spec §17) — the user explicitly accepts the
 * already-rendered fallback (built from the unmodified Character Master
 * cutout when AI failed) instead of retrying. No re-render needed: the
 * sticker was already validly rendered with `characterMode:
 * "original_character"`, it was just held back from "ready" by
 * `status: "needs_ai"`. This just releases that hold.
 */
export function acceptOriginalCharacter(item: PackStickerItem): PackStickerItem {
  if (item.status !== "needs_ai") return item;
  return {
    ...item,
    status: item.validation?.passed ? "ready" : "needs_fix",
    characterMode: "original_character",
  };
}

/** Re-renders one sticker after a manual edit in the shared editor (spec
 * §20/§16: Render -> Normalize -> Validate again) — no AI, no
 * re-composition, exactly like the single-sticker editor's own save path. */
export async function saveEditedPackSticker(item: PackStickerItem): Promise<PackStickerItem> {
  if (!item.project) return item;
  const outcome = await refreshAfterEdit(item.project);
  return {
    ...item,
    project: outcome.project,
    finalCanvas: outcome.finalCanvas,
    validation: outcome.validation,
    status: outcome.validation.passed ? "ready" : "needs_fix",
  };
}
