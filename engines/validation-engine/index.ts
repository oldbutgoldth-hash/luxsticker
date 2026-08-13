import type { ValidationCheck, ValidationResult } from "@/types";
import type { ExportProfile } from "@/config/export-profiles";
import { getStickerContentBounds } from "@/lib/content-bounds";
import { detectBackgroundLeak } from "./background-leak";

export { detectBackgroundLeak } from "./background-leak";
export type { BackgroundLeakResult } from "./background-leak";

const PADDING_TOLERANCE_PX = 2; // float/rounding slack
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export interface ValidationInput {
  finalCanvas: HTMLCanvasElement;
  /** True if opaque pixels touched the edge of the pre-crop working canvas —
   * a sign something was genuinely clipped and can't be recovered. */
  workingCanvasClipped: boolean;
  /** True if the character cutout is the raw original photo because AI
   * background removal failed (spec §10 fallback path). */
  isFallbackCutout: boolean;
  profile: ExportProfile;
}

/**
 * Final Validation (Phase 1.2 §12) — 8 checks against a target export
 * profile (LINE_STICKER by default), run on the actual normalized canvas
 * right before Download. Every check reads content bounds from the shared
 * `getStickerContentBounds` (spec §11 single source of truth) so this can
 * never disagree with what crop-engine actually cropped to.
 */
export async function validateSticker(input: ValidationInput): Promise<ValidationResult> {
  const { finalCanvas, workingCanvasClipped, isFallbackCutout, profile } = input;
  const checks: ValidationCheck[] = [];
  const contentBounds = getStickerContentBounds(finalCanvas);

  // 01. Background transparent — real leak detection (corners + all 4 edges
  // + everything outside the content box), not just "some pixel is transparent".
  const leak = detectBackgroundLeak(finalCanvas, contentBounds);
  checks.push({
    id: "transparency",
    label: "01 Background",
    passed: !leak.hasLeak,
    message: leak.hasLeak
      ? `พบพื้นหลังทึบหลุดออกมา (มุม:${leak.cornersOk ? "ok" : "leak"} ขอบ:${leak.edgesOk ? "ok" : "leak"} รอบ Content:${leak.outsideContentBoxOk ? "ok" : "leak"}, alpha สูงสุด ${leak.maxOutsideAlpha})`
      : "พื้นหลังโปร่งใส (ตรวจมุม/ขอบ/พื้นที่รอบ Content แล้ว)",
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

  // 04. Dimensions within profile bounds
  const dimsOk = finalCanvas.width <= profile.maxWidth && finalCanvas.height <= profile.maxHeight;
  checks.push({
    id: "dimensions",
    label: "04 Dimensions Valid",
    passed: dimsOk,
    message: dimsOk
      ? `${finalCanvas.width}×${finalCanvas.height}px (≤ ${profile.maxWidth}×${profile.maxHeight})`
      : `ขนาด ${finalCanvas.width}×${finalCanvas.height}px เกิน ${profile.maxWidth}×${profile.maxHeight}px`,
  });

  // 05. Even dimensions (own check — separate from "within bounds")
  const evenOk = !profile.requireEvenDimensions || (finalCanvas.width % 2 === 0 && finalCanvas.height % 2 === 0);
  checks.push({
    id: "even-dimensions",
    label: "05 Even Dimensions",
    passed: evenOk,
    message: evenOk ? "ความกว้าง/สูงเป็นเลขคู่" : `${finalCanvas.width}×${finalCanvas.height}px ต้องเป็นเลขคู่ทั้งคู่`,
  });

  // 06. Padding: transparent margin around content, using the shared bounds
  let paddingOk = false;
  let minMargin = 0;
  if (contentBounds) {
    const left = contentBounds.x;
    const top = contentBounds.y;
    const right = finalCanvas.width - (contentBounds.x + contentBounds.width);
    const bottom = finalCanvas.height - (contentBounds.y + contentBounds.height);
    minMargin = Math.min(left, top, right, bottom);
    paddingOk = minMargin >= profile.minPaddingPx - PADDING_TOLERANCE_PX;
  }
  checks.push({
    id: "padding",
    label: "06 Padding",
    passed: paddingOk,
    message: paddingOk
      ? `มีพื้นที่ขอบรอบ Content เพียงพอ (~${Math.round(minMargin)}px)`
      : `พื้นที่ขอบไม่พอ (~${Math.round(minMargin)}px ต้องการอย่างน้อย ${profile.minPaddingPx}px)`,
  });

  // 07 & 08: Valid PNG + file size, checked on the real export blob
  const blob = await new Promise<Blob | null>((resolve) =>
    finalCanvas.toBlob(resolve, profile.format === "png" ? "image/png" : undefined)
  );
  const isPng = !!blob && blob.type === "image/png";
  let pngSignatureOk = false;
  if (blob) {
    const head = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
    pngSignatureOk = PNG_SIGNATURE.every((b, i) => head[i] === b);
  }
  checks.push({
    id: "png-valid",
    label: "07 PNG Valid",
    passed: isPng && pngSignatureOk,
    message: isPng && pngSignatureOk ? "ไฟล์ PNG ถูกต้อง" : "ไฟล์ไม่ใช่ PNG ที่ถูกต้อง",
  });

  const sizeOk = !!blob && blob.size <= profile.maxFileSizeBytes;
  checks.push({
    id: "file-size",
    label: "08 File Size",
    passed: sizeOk,
    message: blob
      ? `${(blob.size / 1024).toFixed(0)} KB${sizeOk ? "" : ` (เกิน ${Math.round(profile.maxFileSizeBytes / 1024)} KB)`}`
      : "ไม่สามารถคำนวณขนาดไฟล์ได้",
  });

  return {
    passed: checks.every((c) => c.passed),
    checks,
    meta: { width: finalCanvas.width, height: finalCanvas.height, fileSizeBytes: blob?.size ?? 0 },
  };
}
