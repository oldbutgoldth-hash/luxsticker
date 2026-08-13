import type {
  CharacterMaster,
  PackStickerItem,
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
  canvasSize = CANVAS_SIZE
): StickerProject {
  const style = planItem.styleOverride ?? packStyle;
  const preset = COMPOSITION_PRESETS[planItem.compositionPresetId];
  const stylePreset = STYLE_PRESETS[style];

  // Same "fit to ~70% of the canvas's shorter side" rule the single-sticker
  // flow uses (engines/background-remover), then the preset's own multiplier.
  const targetSpan = Math.min(canvasSize.width, canvasSize.height) * 0.7;
  const longerSide = Math.max(master.naturalWidth, master.naturalHeight);
  const baseScale = longerSide > 0 ? targetSpan / longerSide : 1;

  const character = characterLayerFromMaster(master, {
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
  profile: ExportProfile = DEFAULT_EXPORT_PROFILE
): Promise<GenerationOutcome> {
  const project = buildProjectForPlanItem(master, planItem, packStyle, canvasSize);
  return runGenerationPipeline(project, profile, decorationOverridesForPlanItem(planItem));
}

export function toPackStickerItem(planItem: StickerPlanItem, outcome: GenerationOutcome): PackStickerItem {
  return {
    id: nextId("sticker"),
    planItemId: planItem.id,
    order: planItem.order,
    filename: packStickerFilename(planItem.order),
    project: outcome.project,
    finalCanvas: outcome.finalCanvas,
    validation: outcome.validation,
    status: outcome.validation.passed ? "ready" : "needs_fix",
    attempts: 1,
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
