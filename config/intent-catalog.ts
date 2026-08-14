import type { IntentId } from "@/types";

/**
 * Phase 3.3 §8 — "Sticker Intent" catalog. Each entry is a short, concrete
 * ACTION/SITUATION description (not a facial expression, not a static
 * gesture — those are ExpressionId/PoseId) meant to give the AI prompt a
 * small scene to depict, e.g. "actively eating a bowl of food" rather than
 * just "hand on stomach". Consumed by lib/expression-prompt-builder.ts as
 * the prompt's Action clause, kept separate from Expression/Pose so each
 * axis stays independently swappable (spec's own separation of Expression /
 * Pose / Action / Camera Framing in §9).
 */
export interface IntentDefinition {
  id: IntentId;
  labelTh: string;
  description: string;
}

export const INTENT_CATALOG: Record<IntentId, IntentDefinition> = {
  hungry_eating: { id: "hungry_eating", labelTh: "หิวและกำลังจะกิน", description: "actively eating or reaching for a bowl of food, food visible near the character" },
  travel_ready: { id: "travel_ready", labelTh: "พร้อมเดินทาง", description: "wearing or carrying a small travel bag, ready to set off on a trip" },
  fighting_spirit: { id: "fighting_spirit", labelTh: "ฮึดสู้", description: "charged up with determination, as if psyching up before a challenge" },
  going_to_sleep: { id: "going_to_sleep", labelTh: "กำลังจะนอน", description: "settling in to sleep, eyes drooping, getting comfortable to rest" },
  thanking: { id: "thanking", labelTh: "กำลังขอบคุณ", description: "actively expressing gratitude, as if just received something appreciated" },
  celebrating: { id: "celebrating", labelTh: "กำลังฉลอง", description: "in the middle of celebrating, festive and triumphant energy" },
  apologizing: { id: "apologizing", labelTh: "กำลังขอโทษ", description: "actively apologizing, slightly bowing with a sheepish look" },
  missing_someone: { id: "missing_someone", labelTh: "กำลังคิดถึง", description: "gazing off wistfully as if thinking of someone far away" },
  laughing_hard: { id: "laughing_hard", labelTh: "หัวเราะหนักมาก", description: "caught in the middle of a big laugh, unable to hold it in" },
  greeting_warmly: { id: "greeting_warmly", labelTh: "กำลังทักทายอย่างอบอุ่น", description: "in the middle of a warm, energetic greeting toward the viewer" },
};

export const INTENT_IDS: IntentId[] = Object.keys(INTENT_CATALOG) as IntentId[];
