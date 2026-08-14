import type { ExpressionId, PoseId, StyleId } from "@/types";
import { EXPRESSION_CATALOG } from "@/config/expression-presets";
import { POSE_CATALOG } from "@/config/pose-catalog";
import { STYLE_PRESETS } from "@/styles/style-presets";

/** English style labels for the prompt (STYLE_PRESETS only has Thai labels,
 * which aren't useful inside an English generation prompt). Phase 3.1 adds
 * the 4 new Character Art Styles; `real` is unused in practice (Mode A never
 * calls this — see isRealPhotoStyle() in types/index.ts) but kept for type
 * completeness. */
const STYLE_PROMPT_LABEL: Record<StyleId, string> = {
  cute: "cute, soft pastel",
  funny: "bold, comedic, high-contrast",
  kawaii: "kawaii, pastel with a double outline",
  real: "realistic, photo-based",
  cartoon: "clean modern cartoon",
  chibi: "chibi, oversized head, small body",
  comic: "comic book, bold ink outlines",
  hand_drawn: "hand-drawn doodle",
};

export interface ExpressionPromptInput {
  emotion: ExpressionId;
  pose: PoseId;
  style: StyleId;
  /** Rough shot framing hint (Phase 3 §12/§13 — "Full/half body based on
   * composition"). Optional: callers that don't yet thread their
   * composition preset through just get the sensible sticker-shot default. */
  composition?: "full-body" | "half-body" | "auto";
}

/**
 * Bumped whenever the prompt's STRUCTURE or wording changes materially
 * (not for catalog/label copy edits). Part of the expression cache key
 * (spec Phase 3 §23: "...promptVersion") so a prompt-engineering change
 * can never silently serve a stale image generated under the old wording.
 * v3 (Phase 3.1): adds each Style's own `promptDirective` art-direction
 * clause (spec §6/§37 "Character Identity" + "Cartoon Transformation").
 */
export const PROMPT_VERSION = "v3";

/**
 * buildExpressionPrompt (spec §12) — the ONE place in the app that turns
 * {emotion, pose, style, composition} into prompt text for an AI image
 * provider. Nothing else (no component, no provider) is allowed to
 * construct its own prompt string — every caller (single-sticker flow, pack
 * flow, any future provider) goes through this function, so changing
 * prompt wording/strategy later is a one-file, one-version-bump change.
 *
 * Structure follows spec §13/§14 exactly: positive preservation directives
 * first ("keep the same person", "preserve X"), then the one thing that's
 * allowed to change (expression + pose), then an explicit negative list so
 * the model isn't tempted to "improve", redesign the character, or — the
 * one negative directive that matters most for a Thai sticker app — try to
 * render any text itself (spec §13/§14: "ห้ามให้ AI สร้างข้อความ Sticker" —
 * AI models routinely render Thai text incorrectly; all sticker text comes
 * from this app's own Canvas Text Engine, always applied AFTER this image
 * comes back, never baked in by the AI).
 *
 * Phase 3.1 (spec §6/§7/§37): also folds in the chosen Style's own
 * `promptDirective` (styles/style-presets.ts) — this is what makes a single
 * `generateExpression()` call double as `transformToCartoon()` (see
 * lib/expression-pipeline.ts): the SAME engine already took `style` as an
 * input, so "transform art style" and "change expression/pose" are just two
 * directives inside one prompt, not two separate AI calls. Identity
 * preservation directives stay first and are made stronger for non-photo
 * styles specifically, since redrawing a whole character (not just
 * expression) is a bigger transformation and more likely to drift.
 */
export function buildExpressionPrompt(input: ExpressionPromptInput): string {
  const expression = EXPRESSION_CATALOG[input.emotion];
  const pose = POSE_CATALOG[input.pose];
  const stylePreset = STYLE_PRESETS[input.style];
  const styleLabel = STYLE_PROMPT_LABEL[input.style] ?? stylePreset?.labelTh ?? input.style;
  const isArtTransformation = input.style !== "real" && Boolean(stylePreset?.promptDirective);
  const shot =
    input.composition === "full-body"
      ? "full-body shot"
      : input.composition === "half-body"
        ? "half-body / waist-up shot"
        : "half-body or full-body shot, whichever suits the pose";

  const positive = [
    "Keep the same person.",
    "Preserve facial identity exactly.",
    "Preserve hairstyle and hair color exactly.",
    "Preserve skin tone exactly.",
    "Preserve body proportions and body shape exactly.",
    "Preserve clothing exactly.",
    "Preserve accessories exactly.",
    "Preserve overall identity.",
    ...(isArtTransformation
      ? [
          `Transform the character into this art style: ${stylePreset.promptDirective}.`,
          "Even though the art style changes, this must still be recognizably the same specific person — same face shape, same hairstyle and hair color, same skin tone, same clothing, same accessories, same body type, just redrawn in the new art style.",
        ]
      : []),
    `Change only the facial expression to: ${expression.description}.`,
    `Change only the body pose to: ${pose.description}.`,
    `Render in a ${styleLabel} sticker illustration style.`,
    `Use a ${shot}, centered, sticker-ready composition.`,
    "Plain white or transparent background, no scenery.",
  ];

  const negative = [
    "Do not change identity.",
    "Do not change hairstyle.",
    "Do not change clothing.",
    "Do not add extra people.",
    "Do not remove accessories.",
    "Do not change age.",
    "Do not change skin tone.",
    "Do not create a different person.",
    "Do not draw duplicate or extra limbs.",
    "Do not render any text, letters, or words in the image.",
    "No background.",
  ];

  return [...positive, "Negative prompt:", ...negative].join(" ");
}
