import type { StickerProject, ValidationResult } from "@/types";
import { loadImage } from "./image-loader";
import { measurementContext, renderWorkingCanvas } from "./render";
import { autoCompose } from "@/engines/composition-engine";
import { generateDecorations } from "@/engines/decoration-engine";
import { autoCropCanvas } from "@/engines/crop-engine";
import { validateSticker } from "@/engines/validation-engine";
import { expandRect } from "./canvas-utils";

export interface GenerationOutcome {
  project: StickerProject;
  finalCanvas: HTMLCanvasElement;
  validation: ValidationResult;
}

/**
 * Runs ADD TEXT → ADD DECORATION → AUTO COMPOSITION → AUTO CROP →
 * TRANSPARENT PNG → FINAL VALIDATION (spec workflow steps 6-11/15) in one
 * shot. Only called on "Generate" / "Regenerate" — never on every keystroke
 * or drag, per the §20 performance rule (those go straight through
 * renderWorkingCanvas instead, no engines re-run).
 */
export async function runGenerationPipeline(project: StickerProject): Promise<GenerationOutcome> {
  if (!project.character || !project.text) {
    throw new Error("ต้องมีทั้งภาพตัวละครและข้อความก่อนสร้างสติ๊กเกอร์");
  }

  const image = await loadImage(project.character.cutoutUrl);
  const ctx = measurementContext();

  const composed = autoCompose(ctx, project.canvasSize, image, project.character, project.text);

  const decorations = generateDecorations(project.style, project.emotion, project.canvasSize, [
    expandRect(composed.characterRect, 14),
    expandRect(composed.textRect, 14),
  ]);

  const nextProject: StickerProject = {
    ...project,
    character: composed.character,
    text: composed.text,
    decorations,
  };

  const working = await renderWorkingCanvas(nextProject);
  const cropped = autoCropCanvas(working.canvas, 0.06, 20);

  const validation = await validateSticker({
    finalCanvas: cropped.canvas,
    workingCanvasClipped: working.clipped,
    isFallbackCutout: project.character.isFallbackCutout,
  });

  return { project: nextProject, finalCanvas: cropped.canvas, validation };
}

/** Re-renders + re-crops + re-validates after a manual edit (move/resize/
 * rotate/delete/outline-width/text-edit) without touching AI or the
 * auto-composition heuristics — pure canvas work, fast and free. */
export async function refreshAfterEdit(project: StickerProject): Promise<GenerationOutcome> {
  const working = await renderWorkingCanvas(project);
  const cropped = autoCropCanvas(working.canvas, 0.06, 20);
  const validation = await validateSticker({
    finalCanvas: cropped.canvas,
    workingCanvasClipped: working.clipped,
    isFallbackCutout: project.character?.isFallbackCutout ?? false,
  });
  return { project, finalCanvas: cropped.canvas, validation };
}
