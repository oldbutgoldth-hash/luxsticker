import type { AIImageProvider, ExpressionGenerationInput, ExpressionGenerationResult } from "./types";
import { loadImage } from "@/lib/image-loader";
import { createCanvas, get2dContext } from "@/lib/canvas-utils";

const MOCK_MODEL = "mock-expression-v1";
const SIMULATED_DELAY_MS = 120;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * MockExpressionProvider (spec §6) — lets the whole AI Expression pipeline
 * (prompt building, caching, per-sticker status, fallback handling, batch
 * progress, export) be developed and tested end to end without spending a
 * cent on a real API. It NEVER fabricates a new person: it reuses the exact
 * same character-reference cutout it was given (spec §3: identity must be
 * preserved, and a mock that invented a different pose would be lying about
 * what it actually did) and stamps a visible "MOCK — NO AI" badge onto the
 * output so it can never be mistaken for a real generation in a screenshot
 * or bug report (spec §6/§25 — "ห้ามหลอกผู้ใช้ว่าเป็น AI จริง").
 */
export class MockExpressionProvider implements AIImageProvider {
  readonly name = "mock";
  readonly model = MOCK_MODEL;

  async generateExpression(input: ExpressionGenerationInput): Promise<ExpressionGenerationResult> {
    const started = Date.now();
    await delay(SIMULATED_DELAY_MS);

    const image = await loadImage(input.characterReference.cutoutUrl);
    const width = image.naturalWidth || input.characterReference.naturalWidth;
    const height = image.naturalHeight || input.characterReference.naturalHeight;

    const canvas = createCanvas(width, height);
    const ctx = get2dContext(canvas);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    // Visible mock badge — deliberately unmissable, not a subtle watermark.
    const badgeHeight = Math.max(28, Math.round(height * 0.07));
    const fontSize = Math.max(14, Math.round(badgeHeight * 0.55));
    ctx.save();
    ctx.fillStyle = "rgba(220, 38, 38, 0.92)";
    ctx.fillRect(0, 0, width, badgeHeight);
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`MOCK — NO AI (${input.emotion}/${input.pose})`, width / 2, badgeHeight / 2);
    ctx.restore();

    const cutoutUrl = canvas.toDataURL("image/png");
    const generationTimeMs = Date.now() - started;

    return {
      image: { cutoutUrl, width, height, hasTransparency: true },
      metadata: { provider: this.name, model: this.model, generationTimeMs, mock: true },
    };
  }
}

export const mockExpressionProvider = new MockExpressionProvider();
