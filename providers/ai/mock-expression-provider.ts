import type { AIImageProvider, ExpressionGenerationInput, ExpressionGenerationResult } from "./types";
import { loadImage } from "@/lib/image-loader";

const MOCK_MODEL = "mock-expression-v1";
const SIMULATED_DELAY_MS = 120;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * MockExpressionProvider (spec §6, tightened Phase 3.3 §24/§25) — lets the
 * whole AI Expression pipeline (prompt building, caching, per-sticker
 * status, fallback handling, batch progress, export) be developed and
 * tested end to end without spending a cent on a real API. It NEVER
 * fabricates a new person: it reuses the exact same character-reference
 * cutout it was given (spec §3: identity must be preserved, and a mock
 * that invented a different pose would be lying about what it actually
 * did).
 *
 * Phase 3.3 fix (§24 "REMOVE MOCK LABEL FROM FINAL ARTWORK"): earlier this
 * provider stamped a red "MOCK — NO AI" badge directly onto the returned
 * image's pixels via canvas. That was wrong — those pixels are exactly what
 * ends up in the final exported sticker PNG, so the badge was leaking into
 * "real" deliverables. Baking any watermark into the artwork itself is now
 * explicitly forbidden by spec, even for mock output. This provider is now
 * a pure passthrough: it returns the character reference image completely
 * unmodified (no canvas pass at all — just decode-to-confirm-it's-valid,
 * then hand back the original URL/dimensions). "This came from mock, not
 * real AI" is communicated ONLY through `metadata.mock: true`, which the UI
 * layer (badges in PackDashboardGrid/PackStickerEditorModal, the pack-level
 * dev-mode banner, and the export-time mock notice — see pack-export.ts)
 * renders as an on-screen label. That UI label never touches the image
 * bytes, so it can never be baked into an exported PNG.
 */
export class MockExpressionProvider implements AIImageProvider {
  readonly name = "mock";
  readonly model = MOCK_MODEL;

  async generateExpression(input: ExpressionGenerationInput): Promise<ExpressionGenerationResult> {
    const started = Date.now();
    await delay(SIMULATED_DELAY_MS);

    // Decode to confirm the reference is actually a valid, loadable image —
    // mirrors what a real provider call would guarantee — but the pixels
    // themselves are never touched or redrawn.
    const image = await loadImage(input.characterReference.cutoutUrl);
    const width = image.naturalWidth || input.characterReference.naturalWidth;
    const height = image.naturalHeight || input.characterReference.naturalHeight;

    const generationTimeMs = Date.now() - started;

    return {
      image: {
        cutoutUrl: input.characterReference.cutoutUrl,
        width,
        height,
        hasTransparency: true,
      },
      metadata: { provider: this.name, model: this.model, generationTimeMs, mock: true },
    };
  }
}

export const mockExpressionProvider = new MockExpressionProvider();
