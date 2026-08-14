import type {
  AiGenerationStatus,
  CharacterMode,
  CharacterReferenceSource,
  CharacterSource,
  ExpressionGenerationMetadata,
  ExpressionId,
  PoseId,
  StyleId,
} from "@/types";
import { getAIImageProvider } from "@/providers/ai/registry";
import type { ExpressionGenerationImage } from "@/providers/ai/types";
import { buildExpressionPrompt } from "./expression-prompt-builder";
import { buildExpressionCacheKey, getCachedExpression, setCachedExpression } from "./expression-cache";
import { defaultAIProvider } from "@/providers/imgly-provider";

export interface GenerateCharacterExpressionOutcome {
  /** Ready to pass straight into `characterLayerFromMaster` — already
   * guaranteed-transparent, whichever path produced it. */
  source: CharacterSource;
  aiStatus: AiGenerationStatus;
  aiError?: string;
  aiMetadata?: ExpressionGenerationMetadata;
  characterMode: CharacterMode;
}

async function urlToFile(url: string, filename: string): Promise<File> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "image/png" });
}

/** Spec §15 — if the provider didn't return a transparent PNG itself, route
 * its output through the EXISTING background-removal engine (Phase 1,
 * unmodified) before it's allowed to become a sticker character layer.
 * Never ships an AI output with a background baked in as a "final sticker". */
async function ensureTransparent(image: ExpressionGenerationImage): Promise<ExpressionGenerationImage> {
  if (image.hasTransparency) return image;
  const file = await urlToFile(image.cutoutUrl, "expression.png");
  const result = await defaultAIProvider.removeBackground(file);
  return { cutoutUrl: result.cutoutUrl, width: image.width, height: image.height, hasTransparency: !result.isFallback };
}

/**
 * generateCharacterExpression (spec §16 pipeline step "Character Master ->
 * AI Expression -> Background Removal (if needed) -> Sticker Character
 * Layer") — the ONE shared engine both the pack flow (lib/pack-pipeline.ts)
 * and the single-sticker flow call (spec §32: "ไม่ควรสร้าง Engine ซ้ำ").
 * Never throws: a provider failure is caught and reported back as
 * `aiStatus: "AI_FAILED"` with `characterMode: "original_character"` (the
 * caller falls back to the unmodified Character Master cutout) so a single
 * sticker's AI failure can never take down the whole batch (spec §17).
 */
export async function generateCharacterExpression(
  reference: CharacterReferenceSource,
  expression: ExpressionId,
  pose: PoseId,
  style: StyleId,
  providerName: string
): Promise<GenerateCharacterExpressionOutcome> {
  const cacheKey = buildExpressionCacheKey({ characterHash: reference.characterHash, emotion: expression, pose, style });
  const cached = getCachedExpression(cacheKey);
  if (cached) {
    return {
      source: {
        originalUrl: reference.originalUrl,
        cutoutUrl: cached.image.cutoutUrl,
        naturalWidth: cached.image.width,
        naturalHeight: cached.image.height,
        isFallbackCutout: false,
      },
      aiStatus: "AI_READY",
      aiMetadata: cached.metadata,
      characterMode: "ai_expression",
    };
  }

  try {
    const provider = getAIImageProvider(providerName);
    const prompt = buildExpressionPrompt({ emotion: expression, pose, style });
    const result = await provider.generateExpression({
      characterReference: reference,
      emotion: expression,
      pose,
      style,
      prompt,
    });

    const transparentImage = await ensureTransparent(result.image);
    const processed = { image: { ...transparentImage, hasTransparency: true }, metadata: result.metadata };
    setCachedExpression(cacheKey, processed);

    return {
      source: {
        originalUrl: reference.originalUrl,
        cutoutUrl: processed.image.cutoutUrl,
        naturalWidth: processed.image.width,
        naturalHeight: processed.image.height,
        isFallbackCutout: false,
      },
      aiStatus: "AI_READY",
      aiMetadata: processed.metadata,
      characterMode: "ai_expression",
    };
  } catch (err) {
    console.error("[expression-pipeline] generateCharacterExpression failed:", err);
    return {
      source: {
        originalUrl: reference.originalUrl,
        cutoutUrl: reference.cutoutUrl,
        naturalWidth: reference.naturalWidth,
        naturalHeight: reference.naturalHeight,
        isFallbackCutout: reference.isFallbackCutout,
      },
      aiStatus: "AI_FAILED",
      aiError: err instanceof Error ? err.message : "AI สร้างภาพไม่สำเร็จ ลองใหม่อีกครั้ง",
      characterMode: "original_character",
    };
  }
}
