import type {
  AiGenerationStatus,
  AIArtworkScore,
  CharacterMode,
  CharacterReferenceSource,
  CharacterSource,
  ExpressionGenerationMetadata,
  ExpressionId,
  IntentId,
  PoseId,
  StyleId,
} from "@/types";
import { getAIImageProvider } from "@/providers/ai/registry";
import type { ExpressionGenerationImage } from "@/providers/ai/types";
import { buildExpressionPrompt, PROMPT_VERSION } from "./expression-prompt-builder";
import { buildExpressionCacheKey, getCachedExpression, setCachedExpression } from "./expression-cache";
import { defaultAIProvider } from "@/providers/imgly-provider";
import { loadImage } from "./image-loader";
import {
  alphaBoundingBox,
  averageOpaqueColor,
  connectedOpaqueRegionCount,
  createCanvas,
  dominantColorDistance,
  get2dContext,
  textLikeEdgeDensity,
} from "./canvas-utils";

export interface GenerateCharacterExpressionOutcome {
  /** Ready to pass straight into `characterLayerFromMaster` — already
   * guaranteed-transparent, whichever path produced it. */
  source: CharacterSource;
  aiStatus: AiGenerationStatus;
  aiError?: string;
  aiMetadata?: ExpressionGenerationMetadata;
  characterMode: CharacterMode;
  /** Phase 3.3 §19/§20 — set whenever an AI result was actually scored
   * (mock or real, success or eventual-failure-after-retries). Undefined
   * only when nothing was ever generated (e.g. a cache hit skips scoring
   * and reuses the cached result's — see cache read path below). */
  artworkScore?: AIArtworkScore;
  /** Phase 3.3 §21 — how many bounded retry attempts ran beyond the first
   * before reaching this outcome (0-2). Always 0 on a cache hit. */
  aiRetryCount: number;
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
  /** Phase 3.3 §8 — optional Sticker Intent, folded into the prompt's
   * Action clause and into the cache key (a request with a different
   * intent is a different request). */
  intent?: IntentId;
}

/** Phase 3.3 §21 — "Retry Strategy": bounded, never unlimited. Attempt 1 is
 * the normal request; if it fails the quality gate, attempt 2 retries with
 * a refined prompt (same pose/expression, stronger wording); if THAT also
 * fails, attempt 3 retries with a simplified/refined pose description
 * (less ambiguous for the model to act on). After 3 total attempts, give
 * up and fall back — never a 4th call. (Spec also names "provider/model
 * alternative" as a possible 3rd retry step; this app's `AIImageProvider`
 * registry only ever has ONE provider configured at a time — see
 * /docs/ai-provider.md's Phase 3.3 Model Evaluation section for why no
 * automatic provider-swap is implemented — so attempt 3 uses the pose-
 * refinement variant instead of a provider swap that isn't available.) */
const MAX_AI_ATTEMPTS = 3;

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
/** Phase 3.3 §19 — a `textLikeEdgeDensity` reading above this is treated as
 * a hard rejection (triggers the retry loop / eventual fallback), not just
 * a low score. Deliberately high (conservative) so normal cartoon line-art
 * and hair/fabric detail don't get misidentified as AI-rendered text. */
const TEXT_CONTAMINATION_REJECT_THRESHOLD = 0.32;
/** Phase 3.3 §19 — 2+ connected opaque regions this large is treated as a
 * possible "more than one figure in frame" and rejected, same reasoning. */
const MULTI_SUBJECT_REJECT_COUNT = 2;

function emptyArtworkScore(reason: string): AIArtworkScore {
  return {
    imageQuality: 0,
    singleSubject: null,
    identityConsistency: null,
    poseAdherence: null,
    expressionAdherence: null,
    artifactFree: null,
    textContamination: null,
    notEvaluatedReason: {
      singleSubject: reason,
      identityConsistency: reason,
      poseAdherence: "Pose adherence requires pose-estimation ML not available in this environment.",
      expressionAdherence: "Expression adherence requires facial-landmark ML not available in this environment.",
      artifactFree: "Duplicate/malformed-limb detection requires pose-estimation ML not available in this environment.",
      textContamination: reason,
    },
  };
}

/**
 * scoreAiArtwork (spec §19/§20 — "AIArtworkScore") — computes every
 * sub-score that IS honestly measurable from pixels alone (image quality,
 * a subject-count proxy, a color-based identity proxy, a text-contamination
 * proxy) and explicitly marks the rest `null` with a stated reason (pose
 * adherence, expression adherence, artifact/limb detection — all genuinely
 * require a vision/pose-estimation model this app has no way to run
 * offline). See lib/canvas-utils.ts for what each proxy actually measures
 * and its documented limits. `referenceCutoutUrl` is the ORIGINAL character
 * reference (never a previous sticker with baked-in text, per spec §7 — see
 * generateCharacterExpression's call site for why).
 */
async function scoreAiArtwork(
  sampleCtx: CanvasRenderingContext2D,
  sampleSize: number,
  bboxAreaFraction: number,
  referenceCutoutUrl: string,
  regionCount: number
): Promise<AIArtworkScore> {
  const singleSubject = regionCount === 0 ? 0 : Math.max(0, 1 - (regionCount - 1) * 0.5);

  let identityConsistency: number | null = null;
  const notEvaluatedReason: AIArtworkScore["notEvaluatedReason"] = {
    poseAdherence: "Pose adherence requires pose-estimation ML not available in this environment.",
    expressionAdherence: "Expression adherence requires facial-landmark ML not available in this environment.",
    artifactFree: "Duplicate/malformed-limb detection requires pose-estimation ML not available in this environment.",
  };
  try {
    const outColor = averageOpaqueColor(sampleCtx, sampleSize, sampleSize);
    const refImg = await loadImage(referenceCutoutUrl);
    const refCanvas = createCanvas(sampleSize, sampleSize);
    const refCtx = get2dContext(refCanvas);
    refCtx.clearRect(0, 0, sampleSize, sampleSize);
    refCtx.drawImage(refImg, 0, 0, sampleSize, sampleSize);
    const refColor = averageOpaqueColor(refCtx, sampleSize, sampleSize);
    if (outColor && refColor) {
      identityConsistency = 1 - dominantColorDistance(outColor, refColor);
    } else {
      notEvaluatedReason.identityConsistency = "Reference or output image had no opaque pixels to sample a color from.";
    }
  } catch {
    notEvaluatedReason.identityConsistency = "Could not load the character reference image to compare against.";
  }

  const textDensity = textLikeEdgeDensity(sampleCtx, sampleSize, sampleSize);
  const textContamination = 1 - Math.min(1, textDensity / TEXT_CONTAMINATION_REJECT_THRESHOLD);

  return {
    imageQuality: Math.min(1, bboxAreaFraction / MIN_CONTENT_AREA_FRACTION),
    singleSubject,
    identityConsistency,
    poseAdherence: null,
    expressionAdherence: null,
    artifactFree: null,
    textContamination,
    notEvaluatedReason,
  };
}

/**
 * Image quality gate (spec §17/§19/§20/§41) — run on every AI result (mock
 * or real) before it's allowed to become a `CharacterSource`. Checks: the
 * image actually decodes (corrupt/invalid data throws inside `loadImage`,
 * caught here and reported as a quality failure rather than a raw decode
 * error), has a sane resolution, and has a real subject (non-trivial opaque
 * area) — not just "some AI byte stream came back with HTTP 200".
 *
 * Phase 3.3: also computes the full `AIArtworkScore` (see `scoreAiArtwork`
 * above) and additionally HARD-REJECTS (not just scores) two specific,
 * high-confidence-enough proxy signals: probable multiple subjects in
 * frame, and probable AI-rendered text contamination — both are exactly
 * the "not real AI Sticker Artwork" failure modes spec §19 calls out by
 * name, and both are used to feed `generateCharacterExpression`'s retry
 * loop rather than only being reported after the fact.
 */
async function validateAiImage(
  image: ExpressionGenerationImage,
  referenceCutoutUrl: string
): Promise<{ valid: boolean; reason?: string; score: AIArtworkScore }> {
  if (!image.width || !image.height || image.width < MIN_DIMENSION_PX || image.height < MIN_DIMENSION_PX) {
    return { valid: false, reason: "ภาพที่ได้จาก AI มีขนาดเล็กเกินไปหรือไม่ถูกต้อง", score: emptyArtworkScore("Image failed the resolution check before any pixel analysis ran.") };
  }

  let img: HTMLImageElement;
  try {
    img = await loadImage(image.cutoutUrl);
  } catch {
    return { valid: false, reason: "ภาพที่ได้จาก AI เสียหาย ไม่สามารถเปิดได้", score: emptyArtworkScore("Image failed to decode before any pixel analysis ran.") };
  }
  if (!img.naturalWidth || !img.naturalHeight) {
    return { valid: false, reason: "ภาพที่ได้จาก AI ไม่สมบูรณ์", score: emptyArtworkScore("Image had no natural dimensions before any pixel analysis ran.") };
  }

  const canvas = createCanvas(QUALITY_SAMPLE_SIZE, QUALITY_SAMPLE_SIZE);
  const ctx = get2dContext(canvas);
  ctx.clearRect(0, 0, QUALITY_SAMPLE_SIZE, QUALITY_SAMPLE_SIZE);
  ctx.drawImage(img, 0, 0, QUALITY_SAMPLE_SIZE, QUALITY_SAMPLE_SIZE);
  const bbox = alphaBoundingBox(ctx, QUALITY_SAMPLE_SIZE, QUALITY_SAMPLE_SIZE, 8);
  if (!bbox) {
    return { valid: false, reason: "ภาพที่ได้จาก AI ไม่มีตัวละคร (พื้นที่โปร่งใสทั้งหมด)", score: emptyArtworkScore("Image had no opaque pixels at all — no subject to score.") };
  }
  const areaFraction = (bbox.width * bbox.height) / (QUALITY_SAMPLE_SIZE * QUALITY_SAMPLE_SIZE);
  if (areaFraction < MIN_CONTENT_AREA_FRACTION) {
    return { valid: false, reason: "ภาพที่ได้จาก AI มีเนื้อหาน้อยเกินไป อาจไม่มีตัวละครที่ชัดเจน", score: emptyArtworkScore("Opaque area was too small to be a real subject.") };
  }

  const regionCount = connectedOpaqueRegionCount(ctx, QUALITY_SAMPLE_SIZE, QUALITY_SAMPLE_SIZE);
  const rawTextDensity = textLikeEdgeDensity(ctx, QUALITY_SAMPLE_SIZE, QUALITY_SAMPLE_SIZE);
  const score = await scoreAiArtwork(ctx, QUALITY_SAMPLE_SIZE, areaFraction, referenceCutoutUrl, regionCount);

  if (regionCount >= MULTI_SUBJECT_REJECT_COUNT) {
    return { valid: false, reason: "ภาพที่ได้จาก AI อาจมีมากกว่าหนึ่งตัวละครในภาพ", score };
  }
  if (rawTextDensity >= TEXT_CONTAMINATION_REJECT_THRESHOLD) {
    return { valid: false, reason: "ภาพที่ได้จาก AI อาจมีข้อความที่ AI สร้างขึ้นเอง", score };
  }

  return { valid: true, score };
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
    intent: options.intent,
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
        aiRetryCount: 0,
      };
    }
  }

  // Phase 3.3 §7/§21: never send a PREVIOUSLY AI-GENERATED sticker (which
  // may have baked-in text from a past render) back in as the reference the
  // model is asked to match — always the original Character Master cutout.
  // `reference` here already IS that original cutout by construction (every
  // call site passes the Character Master, never a rendered sticker), so
  // this is enforced structurally rather than needing a runtime check; the
  // reference URL below is what quality-scoring compares the output against
  // for the identity-consistency proxy.
  const referenceCutoutUrl = reference.cutoutUrl;

  let lastError: string | undefined;
  let lastScore: AIArtworkScore | undefined;

  for (let attempt = 0; attempt < MAX_AI_ATTEMPTS; attempt++) {
    try {
      const provider = getAIImageProvider(providerName);
      const retryRefinement: "prompt" | "pose" | undefined = attempt === 1 ? "prompt" : attempt === 2 ? "pose" : undefined;
      const prompt = buildExpressionPrompt({
        emotion: expression,
        pose,
        style,
        composition: options.composition,
        intent: options.intent,
        retryRefinement,
      });
      const result = await provider.generateExpression({
        characterReference: reference,
        emotion: expression,
        pose,
        style,
        prompt,
      });

      const transparentImage = await ensureTransparent(result.image);

      const quality = await validateAiImage(transparentImage, referenceCutoutUrl);
      lastScore = quality.score;
      if (!quality.valid) {
        lastError = quality.reason ?? "ภาพที่ได้จาก AI ไม่ผ่านการตรวจสอบคุณภาพ";
        console.warn(
          `[expression-pipeline] attempt ${attempt + 1}/${MAX_AI_ATTEMPTS} failed quality gate (${expression}/${pose}): ${lastError}`
        );
        continue; // bounded retry — next loop iteration, never an unbounded call
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
        artworkScore: quality.score,
        aiRetryCount: attempt,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : "AI สร้างภาพไม่สำเร็จ ลองใหม่อีกครั้ง";
      console.error(`[expression-pipeline] attempt ${attempt + 1}/${MAX_AI_ATTEMPTS} threw (${expression}/${pose}):`, err);
      // A hard provider error (network/timeout/rate limit) is also worth one
      // bounded retry with the SAME request before giving up — transient
      // failures are common and don't need a refined prompt to succeed.
    }
  }

  console.error(
    `[expression-pipeline] generateCharacterExpression exhausted ${MAX_AI_ATTEMPTS} attempts (${expression}/${pose}):`,
    lastError
  );
  return {
    source: {
      originalUrl: reference.originalUrl,
      cutoutUrl: reference.cutoutUrl,
      naturalWidth: reference.naturalWidth,
      naturalHeight: reference.naturalHeight,
      isFallbackCutout: reference.isFallbackCutout,
    },
    aiStatus: "AI_FAILED",
    aiError: lastError ?? "AI สร้างภาพไม่สำเร็จ ลองใหม่อีกครั้ง",
    characterMode: "original_character",
    artworkScore: lastScore,
    aiRetryCount: MAX_AI_ATTEMPTS - 1,
  };
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
