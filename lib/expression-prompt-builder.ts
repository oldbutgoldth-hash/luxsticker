import type { ExpressionId, IntentId, PoseId, StyleId } from "@/types";
import { EXPRESSION_CATALOG } from "@/config/expression-presets";
import { POSE_CATALOG } from "@/config/pose-catalog";
import { INTENT_CATALOG } from "@/config/intent-catalog";
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
  /** Phase 3.3 §8 — optional Action/situation clause, layered on top of
   * Expression (face) and Pose (gesture). Omitted entirely from the prompt
   * when not provided — Phase 3/3.1/2.5 callers that never pass this behave
   * identically to before. */
  intent?: IntentId;
  /** Phase 3.3 §9/§21 retry escalation hint — when a first attempt fails
   * the quality gate, `generateCharacterExpression`'s bounded retry loop
   * calls this again with a refinement pass so the SECOND attempt isn't a
   * byte-identical request to a provider that just produced a bad result.
   * "prompt": rephrase/strengthen the same request. "pose": fall back to a
   * simpler, less ambiguous pose description less likely to confuse the
   * model. Omitted on a normal (non-retry) call. */
  retryRefinement?: "prompt" | "pose";
}

/**
 * Bumped whenever the prompt's STRUCTURE or wording changes materially
 * (not for catalog/label copy edits). Part of the expression cache key
 * (spec Phase 3 §23: "...promptVersion") so a prompt-engineering change
 * can never silently serve a stale image generated under the old wording.
 * v3 (Phase 3.1): adds each Style's own `promptDirective` art-direction
 * clause (spec §6/§37 "Character Identity" + "Cartoon Transformation").
 * v4 (Phase 3.3 §9): restructures the prompt into explicit labeled
 * sections — Identity / Style / Expression / Action(Intent) / Pose / Camera
 * Framing / Composition — instead of one flat directive list, adds the
 * optional Action clause, strengthens camera-framing language, and adds a
 * `retryRefinement` variant used by the new bounded retry escalation
 * (spec §21) so a retried request isn't identical to the one that just
 * failed the quality gate.
 */
export const PROMPT_VERSION = "v4";

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
 *
 * Phase 3.3 (spec §9): explicitly labeled sections instead of one flat
 * list, in this order: [1] Character Identity (preserve), [2] Art Style
 * (if transforming), [3] Expression (face), [4] Action/Intent (situation,
 * if provided), [5] Pose (body/hands), [6] Camera Framing (shot/angle),
 * [7] Composition (background/crop), then a Negative section. Explicitly
 * ALSO allows the pose/action directives to change hand position, arm
 * position, body angle, and head angle (spec §5/§9 — a real pose change
 * has to be allowed to move more than just "the pose label", or the model
 * has no room to actually vary anything) while keeping every identity trait
 * fixed. Never includes any Thai text anywhere in the string (spec §9 "AI
 * Prompt ต้องไม่รวมข้อความภาษาไทย") — every catalog description used here
 * (EXPRESSION_CATALOG/POSE_CATALOG/INTENT_CATALOG's `.description` field,
 * not `.labelTh`) is authored in English for exactly this reason.
 */
export function buildExpressionPrompt(input: ExpressionPromptInput): string {
  const expression = EXPRESSION_CATALOG[input.emotion];
  const pose = POSE_CATALOG[input.pose];
  const intent = input.intent ? INTENT_CATALOG[input.intent] : undefined;
  const stylePreset = STYLE_PRESETS[input.style];
  const styleLabel = STYLE_PROMPT_LABEL[input.style] ?? stylePreset?.labelTh ?? input.style;
  const isArtTransformation = input.style !== "real" && Boolean(stylePreset?.promptDirective);
  const shot =
    input.composition === "full-body"
      ? "full-body shot, head to feet visible"
      : input.composition === "half-body"
        ? "half-body / waist-up shot"
        : "half-body or full-body shot, whichever suits the pose and action";

  const identity = [
    "[Character Identity — preserve exactly]",
    "Keep the same person.",
    "Preserve facial identity exactly.",
    "Preserve hairstyle and hair color exactly.",
    "Preserve skin tone exactly.",
    "Preserve body proportions and body shape exactly.",
    "Preserve clothing exactly.",
    "Preserve accessories exactly.",
    "Preserve overall identity.",
  ];

  const artStyle = isArtTransformation
    ? [
        "[Art Style]",
        `Transform the character into this art style: ${stylePreset.promptDirective}.`,
        "Even though the art style changes, this must still be recognizably the same specific person — same face shape, same hairstyle and hair color, same skin tone, same clothing, same accessories, same body type, just redrawn in the new art style.",
      ]
    : [`Render in a ${styleLabel} sticker illustration style.`];

  const expressionAction = [
    "[Expression, Action, and Pose — the parts that SHOULD change]",
    `Change the facial expression to: ${expression.description}.`,
    ...(intent ? [`Depict this action or situation: ${intent.description}.`] : []),
    input.retryRefinement === "pose"
      ? `Change the body pose to a clear, simple version of: ${pose.description}. Keep the pose unambiguous and easy to render correctly.`
      : `Change the body pose to: ${pose.description}.`,
    "It is expected and encouraged for hand position, arm position, body angle, and head angle to change as needed to naturally perform this expression, action, and pose — only the identity traits listed above must stay fixed, not the body's position.",
  ];

  const cameraFraming = [
    "[Camera Framing]",
    `Use a ${shot}.`,
    "Camera framing should suit the action — do not default to a stiff, perfectly frontal, arms-at-sides framing for every image; let the angle and crop follow what the pose and action naturally call for.",
  ];

  const composition = [
    "[Composition]",
    "Centered, sticker-ready composition.",
    "Plain white or transparent background, no scenery.",
  ];

  const positive = [
    ...identity,
    ...artStyle,
    ...expressionAction,
    ...cameraFraming,
    ...composition,
    ...(input.retryRefinement === "prompt"
      ? ["This is a refined retry of a previous attempt — make the requested change clearly and unambiguously visible in the result."]
      : []),
  ];

  const negative = [
    "[Negative — must not happen]",
    "Do not change identity.",
    "Do not change hairstyle.",
    "Do not change clothing.",
    "Do not add extra people.",
    "Do not remove accessories.",
    "Do not change age.",
    "Do not change skin tone.",
    "Do not create a different person.",
    "Do not draw duplicate or extra limbs.",
    "Do not render any text, letters, words, logos, or watermarks in the image.",
    "No background.",
  ];

  return [...positive, "Negative prompt:", ...negative].join(" ");
}
