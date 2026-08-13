// ============================================================================
// AIProvider abstraction (spec §18/§19).
// The rest of the app never imports @imgly/background-removal (or any future
// AI SDK) directly — it talks to this interface. Swapping providers, or
// adding server-side providers in later phases, means writing one new class
// here and changing a single line where `defaultAIProvider` is constructed.
// ============================================================================

export interface BackgroundRemovalResult {
  /** Object URL for the untouched original upload. Never mutated. */
  originalUrl: string;
  /** Object URL for the transparent-background cutout PNG. */
  cutoutUrl: string;
  width: number;
  height: number;
  /** True if the provider could not separate the subject and we fell back
   *  to using the original image as-is (spec §19: never fabricate a person). */
  isFallback: boolean;
  warning?: string;
}

/**
 * Reserved for Phase 3 (Advanced AI Expressions / pose generation — spec
 * Phase 2 §34). Phase 2 itself never calls this: packs are built from
 * `Character Master + Graphic Composition + Text + Decoration` only (spec
 * §35: no fake AI — a button that claims to "AI Generate" a pose without a
 * real model behind it is exactly what this project refuses to ship). The
 * interface exists now purely so a future real implementation has a stable
 * shape to fill in.
 */
export interface GenerateExpressionInput {
  /** The single identity source for the character (Character Master's
   * cutout), so any future implementation still respects §5's "one person,
   * every sticker" rule instead of hallucinating a new one. */
  characterReference: { cutoutUrl: string; originalUrl: string };
  emotion: string;
  pose: string;
  style: string;
}

export interface GenerateExpressionResult {
  cutoutUrl: string;
  width: number;
  height: number;
}

export interface AIProvider {
  readonly name: string;

  /** Phase 1: the only method actually used by the app today. */
  removeBackground(file: File): Promise<BackgroundRemovalResult>;

  /** Reserved for Phase 3 (Character Consistency). Not called in Phase 1/2 —
   *  the app explicitly uses "Original Subject Cutout + Graphic Sticker
   *  Treatment" instead of regenerating the person (spec §19/§5). */
  generateCharacter?(input: unknown): Promise<unknown>;

  /** Reserved for Phase 3 (Advanced AI Expressions / pose generation).
   *  Not called anywhere in Phase 1 or 2. */
  generateExpression?(input: GenerateExpressionInput): Promise<GenerateExpressionResult>;

  /** Reserved for a future fully-generative pipeline. */
  generateSticker?(input: unknown): Promise<unknown>;
}

export class NotImplementedError extends Error {
  constructor(method: string, provider: string) {
    super(`${method}() is not implemented by provider "${provider}" yet (planned for a later phase).`);
    this.name = "NotImplementedError";
  }
}
