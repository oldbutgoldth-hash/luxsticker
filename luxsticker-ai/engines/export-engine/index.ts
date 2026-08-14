/**
 * Export (spec §16). Sequential filenames (sticker.png, sticker_01.png, …)
 * lay the groundwork for Phase 2's multi-sticker packs without changing the
 * download call site.
 */
export function nextStickerFilename(existingCount: number): string {
  if (existingCount === 0) return "sticker.png";
  return `sticker_${String(existingCount + 1).padStart(2, "0")}.png`;
}

export async function exportCanvasAsPng(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("ไม่สามารถสร้างไฟล์ PNG ได้");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
