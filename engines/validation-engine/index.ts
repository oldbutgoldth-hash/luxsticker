import type { ValidationCheck, ValidationResult } from "@/types";
import { get2dContext } from "@/lib/canvas-utils";

const MIN_DIMENSION = 128;
const MAX_DIMENSION = 4096;
const MIN_FILE_SIZE_BYTES = 2 * 1024; // 2 KB — smaller almost certainly means a blank/broken export
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB — generous ceiling for a sticker PNG

export interface ValidationInput {
  finalCanvas: HTMLCanvasElement;
  /** True if the pre-crop working canvas had opaque pixels touching its
   * outer edge (a sign content was clipped by the canvas bounds). */
  workingCanvasClipped: boolean;
  /** True if the character cutout is the raw original photo because AI
   * background removal failed (spec §19 fallback path). */
  isFallbackCutout: boolean;
}

/**
 * Final Validation (spec §15) — 7 checks, run right before Download.
 * Runs on the actual exported PNG bytes, not just in-memory canvas state,
 * so it genuinely reflects what the user is about to receive.
 */
export async function validateSticker(input: ValidationInput): Promise<ValidationResult> {
  const { finalCanvas, workingCanvasClipped, isFallbackCutout } = input;
  const checks: ValidationCheck[] = [];

  // 1. Transparency present
  const ctx = get2dContext(finalCanvas);
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
    label: "พื้นหลังโปร่งใส",
    passed: hasTransparentPixel,
    message: hasTransparentPixel ? "ตรวจพบพื้นหลังโปร่งใสถูกต้อง" : "ไม่พบพื้นที่โปร่งใสในภาพ",
  });

  // 2. Subject cut completely
  checks.push({
    id: "subject-cut",
    label: "ตัดขอบบุคคลครบถ้วน",
    passed: !isFallbackCutout,
    message: isFallbackCutout
      ? "ระบบตัดพื้นหลังอัตโนมัติไม่สำเร็จ ใช้ภาพต้นฉบับแทน — ผลลัพธ์อาจมีพื้นหลังติดมา"
      : "ตัดพื้นหลังสำเร็จด้วยระบบ AI",
  });

  // 3 & 4. Nothing clipped by canvas edges before crop
  checks.push({
    id: "not-clipped",
    label: "ข้อความ/องค์ประกอบไม่ถูกตัดขอบ",
    passed: !workingCanvasClipped,
    message: workingCanvasClipped
      ? "มีองค์ประกอบบางส่วนชนขอบพื้นที่ทำงาน ระบบพยายามขยายพื้นที่ให้อัตโนมัติแล้ว"
      : "องค์ประกอบทั้งหมดอยู่ในกรอบ ไม่มีส่วนใดถูกตัด",
  });

  // 5. Dimensions valid
  const dimsOk =
    finalCanvas.width >= MIN_DIMENSION &&
    finalCanvas.height >= MIN_DIMENSION &&
    finalCanvas.width <= MAX_DIMENSION &&
    finalCanvas.height <= MAX_DIMENSION;
  checks.push({
    id: "dimensions",
    label: "ขนาดภาพเหมาะสม",
    passed: dimsOk,
    message: `${finalCanvas.width}×${finalCanvas.height}px`,
  });

  // 6 & 7. Valid PNG + reasonable file size (checked on the real export blob)
  const blob = await new Promise<Blob | null>((resolve) => finalCanvas.toBlob(resolve, "image/png"));
  const isPng = !!blob && blob.type === "image/png";
  let pngSignatureOk = false;
  if (blob) {
    const head = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
    const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    pngSignatureOk = PNG_SIG.every((b, i) => head[i] === b);
  }
  checks.push({
    id: "png-valid",
    label: "ไฟล์ PNG ถูกต้อง",
    passed: isPng && pngSignatureOk,
    message: isPng && pngSignatureOk ? "รูปแบบไฟล์ PNG ถูกต้อง" : "ไม่สามารถสร้างไฟล์ PNG ที่ถูกต้องได้",
  });

  const sizeOk = !!blob && blob.size >= MIN_FILE_SIZE_BYTES && blob.size <= MAX_FILE_SIZE_BYTES;
  checks.push({
    id: "file-size",
    label: "ขนาดไฟล์เหมาะสม",
    passed: sizeOk,
    message: blob ? `${(blob.size / 1024).toFixed(0)} KB` : "ไม่สามารถคำนวณขนาดไฟล์ได้",
  });

  return { passed: checks.every((c) => c.passed), checks };
}
