import type { CharacterLayer } from "@/types";
import { defaultAIProvider } from "@/providers/imgly-provider";
import type { AIProvider } from "@/providers/ai-provider";

export interface RemoveBackgroundOutcome {
  layer: CharacterLayer;
  warning?: string;
}

/**
 * Runs UPLOAD → ANALYZE → REMOVE BACKGROUND (spec workflow steps 1-3) and
 * returns a ready-to-use CharacterLayer, centered at the canvas origin.
 * The original file is preserved untouched inside the returned layer
 * (spec §4: "ห้ามทำลายไฟล์ต้นฉบับ").
 */
export async function removeBackgroundAndBuildLayer(
  file: File,
  canvasSize: { width: number; height: number },
  provider: AIProvider = defaultAIProvider
): Promise<RemoveBackgroundOutcome> {
  const result = await provider.removeBackground(file);

  // Fit the cutout inside ~70% of the canvas on its longer side so there is
  // always room left for the composition engine to place text/decoration.
  const targetSpan = Math.min(canvasSize.width, canvasSize.height) * 0.7;
  const longerSide = Math.max(result.width, result.height);
  const scale = longerSide > 0 ? targetSpan / longerSide : 1;

  const layer: CharacterLayer = {
    id: "character",
    kind: "character",
    x: canvasSize.width / 2,
    y: canvasSize.height / 2,
    scale,
    rotation: 0,
    zIndex: 10,
    originalUrl: result.originalUrl,
    cutoutUrl: result.cutoutUrl,
    naturalWidth: result.width,
    naturalHeight: result.height,
    isFallbackCutout: result.isFallback,
  };

  return { layer, warning: result.warning };
}
