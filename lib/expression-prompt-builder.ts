import type { ExpressionId, PoseId, StyleId } from "@/types";
import { EXPRESSION_CATALOG } from "@/config/expression-presets";
import { POSE_CATALOG } from "@/config/pose-catalog";
import { STYLE_PRESETS } from "@/styles/style-presets";

/** English style labels for the prompt (STYLE_PRESETS only has Thai labels,
 * which aren't useful inside an English generation prompt). */
const STYLE_PROMPT_LABEL: Record<StyleId, string> = {
  cute: "cute, soft pastel",
  funny: "bold, comedic, high-contrast",
  kawaii: "kawaii, pastel with a double outline",
  real: "realistic, photo-based",
};

export interface ExpressionPromptInput {
  emotion: ExpressionId;
  pose: PoseId;
  style: StyleId;
}

/**
 * buildExpressionPrompt (spec §12) — the ONE place in the app that turns
 * {emotion, pose, style} into prompt text for an AI image provider. Nothing
 * else (no component, no provider) is allowed to construct its own prompt
 * string — every caller (single-sticker flow, pack flow, any future
 * provider) goes through this function, so changing prompt wording/strategy
 * later is a one-file change.
 *
 * Structure follows spec §13/§14 exactly: positive preservation directives
 * first ("keep the same person", "preserve X"), then the one thing that's
 * allowed to change (expression + pose), then an explicit negative list so
 * the model isn't tempted to "improve" or redesign the character.
 */
export function buildExpressionPrompt(input: ExpressionPromptInput): string {
  const expression = EXPRESSION_CATALOG[input.emotion];
  const pose = POSE_CATALOG[input.pose];
  const styleLabel = STYLE_PROMPT_LABEL[input.style] ?? STYLE_PRESETS[input.style]?.labelTh ?? input.style;

  const positive = [
    "Keep the same person.",
    "Preserve facial identity exactly.",
    "Preserve hairstyle and hair color exactly.",
    "Preserve skin tone exactly.",
    "Preserve body proportions and body shape exactly.",
    "Preserve clothing exactly.",
    "Preserve accessories exactly.",
    "Preserve overall identity.",
    `Change only the facial expression to: ${expression.description}.`,
    `Change only the body pose to: ${pose.description}.`,
    `Render in a ${styleLabel} sticker illustration style.`,
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
    "No background.",
  ];

  return [...positive, "Negative prompt:", ...negative].join(" ");
}
