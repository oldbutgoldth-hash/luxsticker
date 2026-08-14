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
import { buildExpressionPrompt, PROMPT_VERSION } from "./expression-prompt-builder";
import { buildExpressionCacheKey, getCachedExpression, setCachedExpression } from "./expression-cache";
import { defaultAIProvider } from "@/providers/imgly-provider";
import { loadImage } from "./image-loader";
import { alphaBoundingBox, createCanvas, get2dContext } from "./canvas-utils";

export interface GenerateCharacterExpressionOutcome {
  /** Ready to pass straight into `characterLayerFromMaster` — already
   * guaranteed-transparent, whichever path produced it. */
  source: CharacterSource;
  aiStatus: AiGenerationStatus;
  aiError?: string;
  aiMetadata?: ExpressionGenerationMetadata;
  characterMode: CharacterMode;
}

export interface GenerateCharacterExpressionOptions {
  /** Best-known model name for cache-key purposes (spec Phase 3 §23) —
   * usually threaded down from an `AiStatus.model` the UI already fetched
   * once via GET /api/generate-expression. Falls back to a fixed string per
   * provider when not supplied, which is a known, documented limitation:
   * see /docs/ai-provider.md's Cache section. */
  model?: string;
  /** Spec §23 — "[Regenerate Fresh]": skip the cache read entirely (a new
   * request is always made), but still WRITE the fresh result to cache
   * afterwards so subsequent identical requests can benefit again. */
  forceFresh?: boolean;
  composition?: "full-body" | "half-body" | "auto";
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

const MIN_DIMENSION_PX = 32;
/** Below this fraction of a small sampled canvas being "opaque enough",
 * treat the image as having no real subject — an all-transparent or
 * near-empty AI output is exactly the "no visible corruption but also no
 * character" failure mode spec §17/§41 asks to catch before it ever reaches
 * the sticker pipeline. */
const MIN_CONTENT_AREA_FRACTION = 0.02;
const QUALITY_SAMPLE_SIZE = 128;

/**
 * Image quality gate (spec §17/§41) — run on every AI result (mock or real)
 * before it's allowed to become a `CharacterSource`. Checks: the image
 * actually decodes (corrupt/invalid data throws inside `loadImage`, caught
 * here and reported as a quality failure rather than a raw decode error),
 * has a sane resolution, and has a real subject (non-trivial opaque area) —
 * not just "some AI byte stream came back with HTTP 200".
 */
async function validateAiImage(image: ExpressionGenerationImage): Promise<{ valid: boolean; reason?: string }> {
  if (!image.width || !image.height || image.width < MIN_DIMENSION_PX || image.height < MIN_DIMENSION_PX) {
    return { valid: false, reason: "ภาพที่ได้จาก AI มีขนาดเล็กเกินไปหรือไม่ถูกต้อง" };
  }

  let img: HTMLImageElement;
  try {
    img = await loadImage(image.cutoutUrl);
  } catch {
    return { valid: false, reason: "ภาพที่ได้จาก AI เสียหาย ไม่สามารถเปิดได้" };
  }
  if (!img.naturalWidth || !img.naturalHeight) {
    return { valid: false, reason: "ภาพที่ได้จาก AI ไม่สมบูรณ์" };
  }

  const canvas = createCanvas(QUALITY_SAMPLE_SIZE, QUALITY_SAMPLE_SIZE);
  const ctx = get2dContext(canvas);
  ctx.clearRect(0, 0, QUALITY_SAMPLE_SIZE, QUALITY_SAMPLE_SIZE);
  ctx.drawImage(img, 0, 0, QUALITY_SAMPLE_SIZE, QUALITY_SAMPLE_SIZE);
  const bbox = alphaBoundingBox(ctx, QUALITY_SAMPLE_SIZE, QUALITY_SAMPLE_SIZE, 8);
  if (!bbox) {
    return { valid: false, reason: "ภาพที่ได้จาก AI ไม่มีตัวละคร (พื้นที่โปร่งใสทั้งหมด)" };
  }
  const areaFraction = (bbox.width * bbox.height) / (QUALITY_SAMPLE_SIZE * QUALITY_SAMPLE_SIZE);
  if (areaFraction < MIN_CONTENT_AREA_FRACTION) {
    return { valid: false, reason: "ภาพที่ได้จาก AI มีเนื้อหาน้อยเกินไป อาจไม่มีตัวละครที่ชัดเจน" };
  }
  return { valid: true };
}

function resolveModelForCacheKey(providerName: string, explicitModel?: string): string {
  if (providerName === "mock") return "mock-expression-v1";
  return explicitModel?.trim() || "unknown";
}

/**
 * generateCharacterExpression (spec §16 pipeline step "Character Master ->
 * AI Expression -> Background Removal (if needed) -> Sticker Character
 * Layer") — the ONE shared engine both the pack flow (lib/pack-pipeline.ts)
 * and the single-sticker flow call (spec §32: "ไม่ควรสร้าง Engine ซ้ำ").
 * Never throws: a provider failure, timeout, rate limit, or a quality-gate
 * rejection (spec §17) is caught and reported back as `aiStatus:
 * "AI_FAILED"` with `characterMode: "original_character"` (the caller falls
 * back to the unmodified Character Master cutout) so a single sticker's AI
 * failure can never take down the whole batch (spec §18/§19).
 */
export async function generateCharacterExpression(
  reference: CharacterReferenceSource,
  expression: ExpressionId,
  pose: PoseId,
  style: StyleId,
  providerName: string,
  options: GenerateCharacterExpressionOptions = {}
): Promise<GenerateCharacterExpressionOutcome> {
  const model = resolveModelForCacheKey(providerName, options.model);
  const cacheKey = buildExpressionCacheKey({
    characterHash: reference.characterHash,
    emotion: expression,
    pose,
    style,
    provider: providerName,
    model,
    promptVersion: PROMPT_VERSION,
  });

  if (!options.forceFresh) {
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
  }

  try {
    const provider = getAIImageProvider(providerName);
    const prompt = buildExpressionPrompt({ emotion: expression, pose, style, composition: options.composition });
    const result = await provider.generateExpression({
      characterReference: reference,
      emotion: expression,
      pose,
      style,
      prompt,
    });

    const transparentImage = await ensureTransparent(result.image);

    const quality = await validateAiImage(transparentImage);
    if (!quality.valid) {
      throw new Error(quality.reason ?? "ภาพที่ได้จาก AI ไม่ผ่านการตรวจสอบคุณภาพ");
    }

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

/**
 * transformToCartoon (Phase 3.1 spec §7/§37) — the spec's named entry point
 * for "Original Photo -> AI Cartoon Transformation" (Mode B's pipeline
 * step). Input shape is `{characterReference, style, emotion, pose}`,
 * exactly as spec'd — which is ALSO exactly `generateCharacterExpression`'s
 * existing input shape, because `style` was already one of its parameters
 * (it's threaded into `buildExpressionPrompt`, which now folds each Style's
 * `promptDirective` into the prompt — see expression-prompt-builder.ts).
 *
 * This is a deliberate architectural choice, not a missed requirement:
 * spec §29 ("AI + Graphics Split") and §37 both say cartoon transformation,
 * expression, and pose must all go "through the AI Provider Interface" —
 * they don't have to be three separate provider calls to satisfy that, and
 * making them three separate calls would triple AI cost per sticker and
 * risk identity drift between calls (the character could look subtly
 * different between the "cartoon transform" pass and the "expression" pass).
 * One call that transforms style AND expression AND pose together, sharing
 * the exact same cache/quality-gate/fallback/concurrency machinery Phase 3
 * already built and tested, is both cheaper and more consistent. This
 * function exists as a named, spec-matching entry point so callers that
 * conceptually want "cartoon transformation" don't have to know that detail
 * — it's just a thin, documented alias.
 *
 * For `style === "real"` (Mode A), callers should not call this at all —
 * see `isRealPhotoStyle()` in types/index.ts — Mode A only ever needs
 * `generateCharacterExpression` for expression/pose, with no art
 * transformation directive in the prompt.
 */
export async function transformToCartoon(
  reference: CharacterReferenceSource,
  style: StyleId,
  emotion: ExpressionId,
  pose: PoseId,
  providerName: string,
  options: GenerateCharacterExpressionOptions = {}
): Promise<GenerateCharacterExpressionOutcome> {
  return generateCharacterExpression(reference, emotion, pose, style, providerName, options);
}
