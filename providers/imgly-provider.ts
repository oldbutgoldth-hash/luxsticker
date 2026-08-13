import type { AIProvider, BackgroundRemovalResult } from "./ai-provider";

/**
 * Default Phase-1 AIProvider: client-side background removal via
 * @imgly/background-removal (ONNX Runtime Web + WASM, runs entirely in the
 * browser — no image ever leaves the user's device, and no per-call API
 * cost). This is the "Library ที่เหมาะสมกับ Browser และ Production" chosen
 * for spec §18/§22.
 *
 * If the model fails to load/run (offline, unsupported browser, corrupt
 * file, etc.) we fall back to the original image as its own "cutout" rather
 * than blocking the whole workflow — the rest of the pipeline (outline,
 * text, decoration, crop) still works, and Validation will flag the missing
 * transparency so the user knows to retry with a clearer photo.
 */
export class ImglyBackgroundRemovalProvider implements AIProvider {
  readonly name = "imgly-background-removal";

  async removeBackground(file: File): Promise<BackgroundRemovalResult> {
    const originalUrl = URL.createObjectURL(file);
    const dims = await readImageDimensions(originalUrl);

    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const blob = await removeBackground(file, {
        model: "isnet_fp16",
        output: { format: "image/png", quality: 1 },
        // Fetch the segmentation model from the package's bundled CDN
        // default. Self-hosting these assets is a good Phase-2 optimization.
        progress: () => {},
      });
      const cutoutUrl = URL.createObjectURL(blob);
      return {
        originalUrl,
        cutoutUrl,
        width: dims.width,
        height: dims.height,
        isFallback: false,
      };
    } catch (err) {
      console.error("[ImglyBackgroundRemovalProvider] removeBackground failed, falling back:", err);
      return {
        originalUrl,
        cutoutUrl: originalUrl,
        width: dims.width,
        height: dims.height,
        isFallback: true,
        warning:
          "ระบบตัดพื้นหลังอัตโนมัติไม่สำเร็จ จึงใช้ภาพต้นฉบับแทนชั่วคราว ลองใหม่อีกครั้งหรือเลือกภาพที่พื้นหลังชัดเจนกว่านี้",
      };
    }
  }
}

function readImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = url;
  });
}

export const defaultAIProvider: AIProvider = new ImglyBackgroundRemovalProvider();
