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

export interface AIProvider {
  readonly name: string;

  /** Phase 1: the only method actually used by the app today. */
  removeBackground(file: File): Promise<BackgroundRemovalResult>;

  /** Reserved for Phase 3 (Character Consistency). Not called in Phase 1 —
   *  MVP explicitly uses "Original Subject Cutout + Graphic Sticker
   *  Treatment" instead of regenerating the person (spec §19). */
  generateCharacter?(input: unknown): Promise<unknown>;

  /** Reserved for Phase 4 (Advanced AI Expressions). */
  generateExpression?(input: unknown): Promise<unknown>;

  /** Reserved for a future fully-generative pipeline / Phase 2 batch packs. */
  generateSticker?(input: unknown): Promise<unknown>;
}

export class NotImplementedError extends Error {
  constructor(method: string, provider: string) {
    super(`${method}() is not implemented by provider "${provider}" yet (planned for a later phase).`);
    this.name = "NotImplementedError";
  }
}
