import type { StickerProject, ValidationResult } from "@/types";
import { loadImage } from "./image-loader";
import { measurementContext, renderWorkingCanvas } from "./render";
import { autoCompose } from "@/engines/composition-engine";
import { generateDecorations, type DecorationOverrides } from "@/engines/decoration-engine";
import { normalizeForProfile } from "@/engines/export-normalizer";
import { DEFAULT_EXPORT_PROFILE, type ExportProfile } from "@/config/export-profiles";
import { expandRect } from "./canvas-utils";

export interface GenerationOutcome {
  project: StickerProject;
  finalCanvas: HTMLCanvasElement;
  validation: ValidationResult;
  /** Threaded through so the Download button can re-validate later without
   * re-deriving this from scratch (spec Phase 1.1 §12). */
  workingCanvasClipped: boolean;
}

/**
 * Runs ADD TEXT → ADD DECORATION → AUTO COMPOSITION → AUTO CROP → LINE
 * NORMALIZE → VALIDATION (spec Phase 1.1 workflow) in one shot. Only called
 * on "Generate" / "Regenerate" — never on every keystroke or drag, per the
 * §17 performance rule (those go through refreshAfterEdit / renderWorkingCanvas
 * instead, no AI, no re-composition).
 */
export async function runGenerationPipeline(
  project: StickerProject,
  profile: ExportProfile = DEFAULT_EXPORT_PROFILE,
  /** Phase 2 hook: lets the pack Variation Engine vary decoration density/
   * glyphs per sticker. Omitted by every Phase 1 call site, so single-sticker
   * behavior is byte-for-byte unchanged. */
  decorationOverrides?: DecorationOverrides
): Promise<GenerationOutcome> {
  if (!project.character || !project.text) {
    throw new Error("ต้องมีทั้งภาพตัวละครและข้อความก่อนสร้างสติ๊กเกอร์");
  }

  const image = await loadImage(project.character.cutoutUrl);
  const ctx = measurementContext();

  const composed = autoCompose(ctx, project.canvasSize, image, project.character, project.text);

  const decorations = generateDecorations(
    project.style,
    project.emotion,
    project.canvasSize,
    [expandRect(composed.characterRect, 14), expandRect(composed.textRect, 14)],
    decorationOverrides
  );

  const nextProject: StickerProject = {
    ...project,
    character: composed.character,
    text: composed.text,
    decorations,
  };

  const working = await renderWorkingCanvas(nextProject);
  const { finalCanvas, validation } = await normalizeForProfile({
    workingCanvas: working.canvas,
    workingCanvasClipped: working.clipped,
    isFallbackCutout: project.character.isFallbackCutout,
    profile,
  });

  return { project: nextProject, finalCanvas, validation, workingCanvasClipped: working.clipped };
}

/** Re-renders + re-normalizes + re-validates after a manual edit
 * (move/resize/rotate/delete/outline-width/text-edit) without touching AI
 * or the auto-composition heuristics — pure canvas work, fast and free
 * (spec Phase 1.1 §16/§17: editor + AI-avoidance must keep working). */
export async function refreshAfterEdit(
  project: StickerProject,
  profile: ExportProfile = DEFAULT_EXPORT_PROFILE
): Promise<GenerationOutcome> {
  const working = await renderWorkingCanvas(project);
  const { finalCanvas, validation } = await normalizeForProfile({
    workingCanvas: working.canvas,
    workingCanvasClipped: working.clipped,
    isFallbackCutout: project.character?.isFallbackCutout ?? false,
    profile,
  });
  return { project, finalCanvas, validation, workingCanvasClipped: working.clipped };
}
