import type { CharacterReferenceSource, ExpressionGenerationMetadata, ExpressionId, PoseId, StyleId } from "@/types";

// ============================================================================
// AIImageProvider abstraction (Phase 2.5 §4/§5). The UI and the pack/single-
// sticker pipelines never construct a provider class directly or import a
// vendor SDK — they call `getAIImageProvider(name)` from ./registry and talk
// to this interface only, exactly like `AIProvider` in providers/ai-provider.ts
// already does for background removal (spec §32: reuse the existing pattern,
// don't invent a parallel one).
// ============================================================================

export interface ExpressionGenerationInput {
  /** The single identity source (Character Master, or an ad-hoc equivalent
   * built by the single-sticker flow) sent as a reference — never randomly
   * regenerated (spec §3: "ห้ามสุ่มสร้างคนใหม่"). */
  characterReference: CharacterReferenceSource;
  emotion: ExpressionId;
  pose: PoseId;
  style: StyleId;
  /** Built by lib/expression-prompt-builder.ts — the provider must not
   * construct its own prompt text (spec §12: one central prompt builder). */
  prompt: string;
}

export interface ExpressionGenerationImage {
  /** Object URL or data URL for the generated character image. */
  cutoutUrl: string;
  width: number;
  height: number;
  /** True if the provider itself returned a transparent PNG. When false, the
   * caller must route this through the existing Background Removal engine
   * before it can be used as a sticker character layer (spec §15/§16). */
  hasTransparency: boolean;
}

export interface ExpressionGenerationResult {
  image: ExpressionGenerationImage;
  metadata: ExpressionGenerationMetadata;
}

export interface AIImageProvider {
  readonly name: string;
  readonly model: string;
  generateExpression(input: ExpressionGenerationInput): Promise<ExpressionGenerationResult>;
}

export class AIImageProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string
  ) {
    super(message);
    this.name = "AIImageProviderError";
  }
}
