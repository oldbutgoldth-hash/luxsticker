import type { ValidationCheck, ValidationResult } from "@/types";
import type { ExportProfile } from "@/config/export-profiles";
import { alphaBoundingBox, get2dContext } from "@/lib/canvas-utils";

const PADDING_TOLERANCE_PX = 2; // float/rounding slack
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export interface ValidationInput {
  finalCanvas: HTMLCanvasElement;
  /** True if opaque pixels touched the edge of the pre-crop working canvas —
   * a sign something was genuinely clipped and can't be recovered. */
  workingCanvasClipped: boolean;
  /** True if the character cutout is the raw original photo because AI
   * background removal failed (spec §7 fallback path). */
  isFallbackCutout: boolean;
  profile: ExportProfile;
}

/**
 * Final Validation (Phase 1.1 §8) — 8 checks against a target export
 * profile (LINE_STICKER by default), run on the actual normalized canvas
 * right before Download so it genuinely reflects what the user is about to
 * receive. No hardcoded 4096×4096 / 10MB generic thresholds anymore —
 * everything comes from the profile.
 */
export async function validateSticker(input: ValidationInput): Promise<ValidationResult> {
  const { finalCanvas, workingCanvasClipped, isFallbackCutout, profile } = input;
  const checks: ValidationCheck[] = [];
  const ctx = get2dContext(finalCanvas);

  // 01. Background transparency
  const { data } = ctx.getImageData(0, 0, finalCanvas.width, finalCanvas.height);
  let hasTransparentPixel = false;
  let hasOpaquePixel = false;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250) hasTransparentPixel = true;
    if (data[i] > 5) hasOpaquePixel = true;
    if (hasTransparentPixel && hasOpaquePixel) break;
  }
  checks.push({
    id: "transparency",
    label: "01 Background",
    passed: hasTransparentPixel,
    message: hasTransparentPixel ? "พื้นหลังโปร่งใส" : "พบพื้นหลังทึบ",
  });

  // 02. Background removal must not be the raw-photo fallback
  checks.push({
    id: "background-removal",
    label: "02 Background Removal",
    passed: !isFallbackCutout,
    message: isFallbackCutout ? "การตัดพื้นหลังยังไม่สำเร็จ" : "ตัดพื้นหลังสำเร็จ",
  });

  // 03. Nothing was clipped before crop ever ran (unrecoverable if it was)
  checks.push({
    id: "content-clipping",
    label: "03 Content Clipping",
    passed: !workingCanvasClipped,
    message: workingCanvasClipped ? "พบองค์ประกอบชนขอบ" : "องค์ประกอบไม่ถูกตัด",
  });

  // 04. Dimensions: within profile bounds and (if required) even
  const withinBounds = finalCanvas.width <= profile.maxWidth && finalCanvas.height <= profile.maxHeight;
  const evenOk =
    !profile.requireEvenDimensions || (finalCanvas.width % 2 === 0 && finalCanvas.height % 2 === 0);
  const dimsOk = withinBounds && evenOk;
  checks.push({
    id: "dimensions",
    label: "04 Dimensions",
    passed: dimsOk,
    message: dimsOk
      ? `${finalCanvas.width}×${finalCanvas.height}px (≤ ${profile.maxWidth}×${profile.maxHeight}, เลขคู่)`
      : !withinBounds
        ? `ขนาด ${finalCanvas.width}×${finalCanvas.height}px เกิน ${profile.maxWidth}×${profile.maxHeight}px`
        : `ขนาด ${finalCanvas.width}×${finalCanvas.height}px ต้องเป็นเลขคู่`,
  });

  // 05. Padding: transparent margin around content, on the final canvas
  const bbox = alphaBoundingBox(ctx, finalCanvas.width, finalCanvas.height, 8);
  let paddingOk = false;
  let minMargin = 0;
  if (bbox) {
    const left = bbox.x;
    const top = bbox.y;
    const right = finalCanvas.width - (bbox.x + bbox.width);
    const bottom = finalCanvas.height - (bbox.y + bbox.height);
    minMargin = Math.min(left, top, right, bottom);
    paddingOk = minMargin >= profile.minPaddingPx - PADDING_TOLERANCE_PX;
  }
  checks.push({
    id: "padding",
    label: "05 Padding",
    passed: paddingOk,
    message: paddingOk
      ? `มีพื้นที่ขอบรอบ Content เพียงพอ (~${Math.round(minMargin)}px)`
      : `พื้นที่ขอบไม่พอ (~${Math.round(minMargin)}px ต้องการอย่างน้อย ${profile.minPaddingPx}px)`,
  });

  // 06 & 07: Valid PNG + file size, checked on the real export blob
  const blob = await new Promise<Blob | null>((resolve) => finalCanvas.toBlob(resolve, profile.format === "png" ? "image/png" : undefined));
  const isPng = !!blob && blob.type === "image/png";
  let pngSignatureOk = false;
  if (blob) {
    const head = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
    pngSignatureOk = PNG_SIGNATURE.every((b, i) => head[i] === b);
  }
  checks.push({
    id: "png-valid",
    label: "06 PNG",
    passed: isPng && pngSignatureOk,
    message: isPng && pngSignatureOk ? "ไฟล์ PNG ถูกต้อง" : "ไฟล์ไม่ใช่ PNG ที่ถูกต้อง",
  });

  const sizeOk = !!blob && blob.size <= profile.maxFileSizeBytes;
  checks.push({
    id: "file-size",
    label: "07 File Size",
    passed: sizeOk,
    message: blob
      ? `${(blob.size / 1024).toFixed(0)} KB${sizeOk ? "" : ` (เกิน ${Math.round(profile.maxFileSizeBytes / 1024)} KB)`}`
      : "ไม่สามารถคำนวณขนาดไฟล์ได้",
  });

  // 08. Final readiness — derived from every other check.
  const readyForUse = checks.every((c) => c.passed);
  checks.push({
    id: "final-readiness",
    label: "08 Final Readiness",
    passed: readyForUse,
    message: readyForUse ? "✓ READY TO USE" : "✗ NOT READY",
  });

  return {
    passed: readyForUse,
    checks,
    meta: { width: finalCanvas.width, height: finalCanvas.height, fileSizeBytes: blob?.size ?? 0 },
  };
}
