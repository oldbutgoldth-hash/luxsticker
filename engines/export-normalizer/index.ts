import type { ValidationResult } from "@/types";
import type { ExportProfile } from "@/config/export-profiles";
import { cropAndFitToBounds } from "@/engines/crop-engine";
import { validateSticker } from "@/engines/validation-engine";

export interface NormalizeInput {
  /** The fully-composited sticker canvas (outline + character + decoration
   * + text flattened), not yet cropped to any particular target size. */
  workingCanvas: HTMLCanvasElement;
  /** True if opaque pixels touched the edge of `workingCanvas` itself —
   * i.e. something was genuinely clipped before this ever ran. Normalizing
   * cannot recover pixels that were never rendered, so this is threaded
   * through to validation as-is (spec §3: "ห้ามตัด Character/Text/Decoration"). */
  workingCanvasClipped: boolean;
  isFallbackCutout: boolean;
  profile: ExportProfile;
}

export interface NormalizeOutcome {
  finalCanvas: HTMLCanvasElement;
  validation: ValidationResult;
}

const SAFETY_OUTLINE_MARGIN_PX = 3;
const MAX_AUTO_FIX_ATTEMPTS = 4;
const FIX_SCALE_STEP = 0.88;
const FIX_PADDING_STEP_PX = 3;

/** Checks the auto-fix loop is allowed to retry its way out of. Background
 * removal failures and pre-crop clipping are deliberately excluded — spec
 * §9: "Background Removal Failed ไม่ควร Auto Fix แบบหลอกๆ ต้องให้ผู้ใช้
 * Generate ใหม่", and clipped content can't be recovered by re-cropping. */
const AUTO_FIXABLE_CHECK_IDS = new Set(["dimensions", "even-dimensions", "padding", "file-size"]);

/**
 * normalizeForProfile (Phase 1.1 §6): Crop → Padding → Scale if necessary →
 * Even dimensions → Validate, tightening padding/scale and re-validating
 * (§9 Auto Fix) when a fixable check still fails — over-sized-for-profile,
 * odd dimensions, insufficient padding, or file too large. Never loops on
 * background-removal failure or content clipping; those need a real
 * regenerate from the user.
 */
export async function normalizeForProfile(input: NormalizeInput): Promise<NormalizeOutcome> {
  const { workingCanvas, workingCanvasClipped, isFallbackCutout, profile } = input;

  let paddingPx = profile.minPaddingPx + SAFETY_OUTLINE_MARGIN_PX;
  let shrink = 1;

  const crop = (): HTMLCanvasElement =>
    cropAndFitToBounds(workingCanvas, {
      maxWidth: Math.max(2, Math.round(profile.maxWidth * shrink)),
      maxHeight: Math.max(2, Math.round(profile.maxHeight * shrink)),
      paddingPx,
      requireEvenDimensions: profile.requireEvenDimensions,
    }).canvas;

  let finalCanvas = crop();
  let validation = await validateSticker({ finalCanvas, workingCanvasClipped, isFallbackCutout, profile });

  let attempts = 0;
  while (!validation.passed && attempts < MAX_AUTO_FIX_ATTEMPTS) {
    const failing = validation.checks.filter((c) => !c.passed);
    const allFixable = failing.length > 0 && failing.every((c) => AUTO_FIXABLE_CHECK_IDS.has(c.id));
    if (!allFixable) break;

    // Over-budget dimensions or an over-sized file both need a smaller
    // canvas; insufficient padding or odd dimensions both need the crop
    // recomputed with a nudged padding value (which also perturbs the
    // rounding that produces even/odd output — §13 Auto Fix).
    if (failing.some((c) => c.id === "file-size" || c.id === "dimensions")) shrink *= FIX_SCALE_STEP;
    if (failing.some((c) => c.id === "padding" || c.id === "even-dimensions")) paddingPx += FIX_PADDING_STEP_PX;
    attempts++;

    finalCanvas = crop();
    const revalidated = await validateSticker({ finalCanvas, workingCanvasClipped, isFallbackCutout, profile });
    validation = {
      passed: revalidated.passed,
      meta: revalidated.meta,
      checks: revalidated.checks.map((c) => {
        const wasFailing = failing.some((f) => f.id === c.id);
        return wasFailing && c.passed ? { ...c, autoFixed: true } : c;
      }),
    };
  }

  return { finalCanvas, validation };
}
