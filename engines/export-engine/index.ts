import type { ValidationResult } from "@/types";
import type { ExportProfile } from "@/config/export-profiles";
import { DEFAULT_EXPORT_PROFILE } from "@/config/export-profiles";
import { normalizeForProfile } from "@/engines/export-normalizer";

/**
 * Export (Phase 1.1 §12/§13). Sequential filenames (sticker.png,
 * sticker_01.png, …) lay the groundwork for Phase 2's multi-sticker packs
 * without changing the download call site.
 */
export function nextStickerFilename(existingCount: number): string {
  if (existingCount === 0) return "sticker.png";
  return `sticker_${String(existingCount + 1).padStart(2, "0")}.png`;
}

export class ExportBlockedError extends Error {
  validation: ValidationResult;
  constructor(message: string, validation: ValidationResult) {
    super(message);
    this.name = "ExportBlockedError";
    this.validation = validation;
  }
}

export interface ExportContext {
  workingCanvasClipped: boolean;
  isFallbackCutout: boolean;
  profile?: ExportProfile;
}

export interface ExportOutcome {
  finalCanvas: HTMLCanvasElement;
  validation: ValidationResult;
}

/**
 * §12 pipeline, enforced every time: Normalize → Validate → Export → check
 * Blob → check size → Download. `canvas` does NOT have to already be
 * profile-normalized — normalizing here is idempotent if it already is, and
 * a hard guarantee otherwise, so nothing can ever download a raw,
 * un-normalized canvas (spec: "ห้าม Download Canvas ต้นฉบับโดยตรงถ้ายังไม่ได้
 * Normalize"). Throws ExportBlockedError (carrying the failing
 * ValidationResult) instead of downloading anything that isn't READY TO USE.
 */
export async function exportCanvasAsPng(
  canvas: HTMLCanvasElement,
  filename: string,
  context: ExportContext
): Promise<ExportOutcome> {
  const profile = context.profile ?? DEFAULT_EXPORT_PROFILE;

  const { finalCanvas, validation } = await normalizeForProfile({
    workingCanvas: canvas,
    workingCanvasClipped: context.workingCanvasClipped,
    isFallbackCutout: context.isFallbackCutout,
    profile,
  });

  if (!validation.passed) {
    throw new ExportBlockedError("ไฟล์ยังไม่ผ่านมาตรฐาน LINE Sticker จึงยังดาวน์โหลดไม่ได้", validation);
  }

  const blob = await new Promise<Blob | null>((resolve) => finalCanvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("ไม่สามารถสร้างไฟล์ PNG ได้");
  if (blob.size > profile.maxFileSizeBytes) {
    throw new ExportBlockedError("ไฟล์มีขนาดเกินที่กำหนดหลัง Normalize", validation);
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);

  return { finalCanvas, validation };
}
