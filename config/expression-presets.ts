import type { EmotionId, ExpressionId, PoseId } from "@/types";

/** Spec §9 — plain-English descriptions used verbatim inside the generated
 * prompt (lib/expression-prompt-builder.ts), plus Thai labels for the UI. */
export interface ExpressionDefinition {
  id: ExpressionId;
  labelTh: string;
  description: string;
}

export const EXPRESSION_CATALOG: Record<ExpressionId, ExpressionDefinition> = {
  greeting: { id: "greeting", labelTh: "ทักทาย", description: "a warm, friendly smile" },
  thankyou: { id: "thankyou", labelTh: "ขอบคุณ", description: "a grateful, gentle smile" },
  ok: { id: "ok", labelTh: "โอเค", description: "a confident, easygoing smile" },
  happy: { id: "happy", labelTh: "ดีใจ", description: "a big, joyful smile with bright eyes" },
  love: { id: "love", labelTh: "รัก", description: "a warm, affectionate smile with soft eyes" },
  miss: { id: "miss", labelTh: "คิดถึง", description: "a tender, wistful expression" },
  sad: { id: "sad", labelTh: "เศร้า", description: "a downcast, sad expression" },
  cry: { id: "cry", labelTh: "ร้องไห้", description: "a crying expression with tears" },
  angry: { id: "angry", labelTh: "โกรธ", description: "an annoyed, angry expression with furrowed brows" },
  shy: { id: "shy", labelTh: "เขิน", description: "a bashful, blushing expression looking slightly away" },
  tired: { id: "tired", labelTh: "เหนื่อย", description: "a weary, tired expression with droopy eyes" },
  sleepy: { id: "sleepy", labelTh: "ง่วง", description: "a drowsy, half-asleep expression" },
  hungry: { id: "hungry", labelTh: "หิว", description: "a hungry, slightly pleading expression" },
  excited: { id: "excited", labelTh: "ตื่นเต้น", description: "an excited expression with wide, sparkling eyes" },
  funny: { id: "funny", labelTh: "ตลก", description: "a laughing, amused expression with eyes scrunched shut" },
  sorry: { id: "sorry", labelTh: "ขอโทษ", description: "an apologetic, sheepish expression" },
  fight: { id: "fight", labelTh: "สู้ๆ", description: "a determined, encouraging expression" },
  goodbye: { id: "goodbye", labelTh: "ลาก่อน", description: "a warm farewell smile" },
  surprise: { id: "surprise", labelTh: "ประหลาดใจ", description: "a surprised expression with wide eyes and open mouth" },
};

export const EXPRESSION_IDS: ExpressionId[] = Object.keys(EXPRESSION_CATALOG) as ExpressionId[];

/** Reasonable default pose per expression — used to seed a plan item's
 * `pose` whenever only the expression is known (e.g. a user-added custom row). */
export const EXPRESSION_DEFAULT_POSE: Record<ExpressionId, PoseId> = {
  greeting: "wave",
  thankyou: "bow",
  ok: "thumbsup",
  happy: "cheer",
  love: "heart_hands",
  miss: "hug_self",
  sad: "hug_self",
  cry: "wipe_tears",
  angry: "fist",
  shy: "hug_self",
  tired: "sit",
  sleepy: "yawn",
  hungry: "hold_stomach",
  excited: "jump",
  funny: "laugh",
  sorry: "bow",
  fight: "fist",
  goodbye: "wave",
  surprise: "jump",
};

export interface ExpressionPresetItem {
  text: string;
  emotion: ExpressionId;
  pose: PoseId;
}

/**
 * Expression Presets (spec §11) — the worked example list from spec §2,
 * text paired with the {emotion, pose} the AI Expression Engine should
 * target. Includes verbatim the 4 examples spec §11 lists by name
 * (สวัสดี/greeting/wave, ขอบคุณ/thankyou/bow, โอเค/ok/thumbsup,
 * หิวข้าว/hungry/hold_stomach) plus the rest of §2's worked example set.
 */
export const EXPRESSION_PRESETS: ExpressionPresetItem[] = [
  { text: "สวัสดี", emotion: "greeting", pose: "wave" },
  { text: "ขอบคุณ", emotion: "thankyou", pose: "bow" },
  { text: "โอเค", emotion: "ok", pose: "thumbsup" },
  { text: "555", emotion: "funny", pose: "laugh" },
  { text: "รักนะ", emotion: "love", pose: "heart_hands" },
  { text: "คิดถึง", emotion: "miss", pose: "hug_self" },
  { text: "หิวข้าว", emotion: "hungry", pose: "hold_stomach" },
  { text: "ง่วงแล้ว", emotion: "sleepy", pose: "yawn" },
  { text: "โกรธแล้วนะ", emotion: "angry", pose: "fist" },
  { text: "ร้องไห้", emotion: "cry", pose: "wipe_tears" },
  { text: "สู้ๆ", emotion: "fight", pose: "fist" },
  { text: "ไปเที่ยวกัน", emotion: "excited", pose: "invite" },
];

/** Bridges Phase 2's `EmotionId` (the pack plan's existing composition/
 * decoration variation key, config/pack-presets.ts + styles/emotion-presets.ts)
 * to the Phase 2.5 {ExpressionId, PoseId} pair, so `buildStickerPlan`
 * (lib/plan-builder.ts, unmodified in its own logic) can still drive AI
 * Expression generation just by looking each plan item's existing `emotion`
 * up in this table — no Phase 2 call site needs to change shape. */
export const EMOTION_EXPRESSION_MAP: Record<EmotionId, { expression: ExpressionId; pose: PoseId }> = {
  sawadee: { expression: "greeting", pose: "wave" },
  thankyou: { expression: "thankyou", pose: "bow" },
  ok: { expression: "ok", pose: "thumbsup" },
  love: { expression: "love", pose: "heart_hands" },
  miss: { expression: "miss", pose: "hug_self" },
  haha: { expression: "funny", pose: "laugh" },
  happy: { expression: "happy", pose: "cheer" },
  shy: { expression: "shy", pose: "hug_self" },
  sulk: { expression: "sad", pose: "hug_self" },
  angry: { expression: "angry", pose: "fist" },
  cry: { expression: "cry", pose: "wipe_tears" },
  hungry: { expression: "hungry", pose: "hold_stomach" },
  sleepy: { expression: "sleepy", pose: "yawn" },
  tired: { expression: "tired", pose: "sit" },
  fight: { expression: "fight", pose: "fist" },
  goodnight: { expression: "goodbye", pose: "wave" },
  custom: { expression: "happy", pose: "stand" },
};
