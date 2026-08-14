import type { EmotionId, ExpressionId, IntentId, PoseId } from "@/types";

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
  // Phase 3.3 §7 — added to reach parity with the spec's named 15-expression list.
  confident: { id: "confident", labelTh: "มั่นใจ", description: "a confident, self-assured smile with chin slightly raised" },
  playful: { id: "playful", labelTh: "ขี้เล่น", description: "a playful, mischievous grin with one eye winking" },
  relaxed: { id: "relaxed", labelTh: "ผ่อนคลาย", description: "a relaxed, content half-smile with calm eyes" },
  embarrassed: { id: "embarrassed", labelTh: "อาย", description: "an embarrassed expression, blushing with a nervous half-smile" },
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
  confident: "thumbsup",
  playful: "point",
  relaxed: "sit",
  embarrassed: "shy_pose",
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

/**
 * Phase 3.3 §6/§27 — "ระบบต้องตรวจว่า Pack เดียวกันไม่ได้ใช้ Pose เดิมซ้ำมากเกินไป"
 * (the same pack must not overuse the same pose). `EMOTION_EXPRESSION_MAP`
 * above gives exactly ONE fixed {expression,pose} pair per emotion — which
 * is precisely why a real pack with repeated emotions (any pack bigger than
 * ~16 stickers built from a preset with ~9-12 distinct emotions WILL repeat
 * emotions) always rendered the same pose for every occurrence of that
 * emotion. That's the concrete, root-cause bug behind the Phase 3.3
 * complaint "ภาพ Sticker ส่วนใหญ่ยังใช้ Character เดิมในท่าเดิม".
 *
 * `EMOTION_EXPRESSION_POOL` gives each emotion 2-4 real variants (different
 * pose, often a different expression flavor too) instead of one. Consumed
 * via `resolveExpressionForOccurrence` below using the SAME per-emotion
 * occurrence counter `buildStickerPlan` (lib/plan-builder.ts) already
 * tracks for composition-preset cycling — no new bookkeeping needed, this
 * is additive to an existing, working pattern (EMOTION_COMPOSITION_AFFINITY
 * uses the identical cycling idea one dimension over).
 *
 * `EMOTION_EXPRESSION_MAP` (above) is left completely unchanged and still
 * used as-is by `createBlankPlanItem` and `StickerGeneratorApp`'s
 * single-sticker flow (spec §1: don't rebuild what's working; a lone
 * single-sticker generation has no "occurrence" concept to cycle against).
 */
export const EMOTION_EXPRESSION_POOL: Record<EmotionId, Array<{ expression: ExpressionId; pose: PoseId }>> = {
  sawadee: [
    { expression: "greeting", pose: "wave" },
    { expression: "greeting", pose: "bow" },
    { expression: "playful", pose: "point" },
  ],
  thankyou: [
    { expression: "thankyou", pose: "bow" },
    { expression: "thankyou", pose: "heart_hands" },
    { expression: "confident", pose: "thumbsup" },
  ],
  ok: [
    { expression: "ok", pose: "thumbsup" },
    { expression: "confident", pose: "point" },
    { expression: "ok", pose: "clap" },
  ],
  love: [
    { expression: "love", pose: "heart_hands" },
    { expression: "shy", pose: "hand_on_cheek" },
    { expression: "love", pose: "hug_self" },
  ],
  miss: [
    { expression: "miss", pose: "hug_self" },
    { expression: "miss", pose: "looking_sideways" },
    { expression: "sad", pose: "sit" },
  ],
  haha: [
    { expression: "funny", pose: "laugh" },
    { expression: "playful", pose: "clap" },
    { expression: "funny", pose: "jump" },
  ],
  happy: [
    { expression: "happy", pose: "cheer" },
    { expression: "excited", pose: "jump" },
    { expression: "happy", pose: "clap" },
  ],
  shy: [
    { expression: "shy", pose: "hug_self" },
    { expression: "embarrassed", pose: "shy_pose" },
    { expression: "shy", pose: "cover_mouth" },
  ],
  sulk: [
    { expression: "sad", pose: "hug_self" },
    { expression: "sad", pose: "sit" },
    { expression: "sad", pose: "looking_sideways" },
  ],
  angry: [
    { expression: "angry", pose: "fist" },
    { expression: "angry", pose: "stand" },
    { expression: "angry", pose: "point" },
  ],
  cry: [
    { expression: "cry", pose: "wipe_tears" },
    { expression: "cry", pose: "sit" },
    { expression: "cry", pose: "cover_mouth" },
  ],
  hungry: [
    { expression: "hungry", pose: "hold_stomach" },
    { expression: "hungry", pose: "sit" },
    { expression: "excited", pose: "point" },
  ],
  sleepy: [
    { expression: "sleepy", pose: "yawn" },
    { expression: "sleepy", pose: "sleeping" },
    { expression: "tired", pose: "sit" },
  ],
  tired: [
    { expression: "tired", pose: "sit" },
    { expression: "tired", pose: "yawn" },
    { expression: "relaxed", pose: "stand" },
  ],
  fight: [
    { expression: "fight", pose: "fist" },
    { expression: "confident", pose: "stand" },
    { expression: "fight", pose: "running" },
  ],
  goodnight: [
    { expression: "goodbye", pose: "wave" },
    { expression: "sleepy", pose: "sleeping" },
    { expression: "relaxed", pose: "yawn" },
  ],
  custom: [
    { expression: "happy", pose: "stand" },
    { expression: "confident", pose: "point" },
    { expression: "playful", pose: "jump" },
  ],
};

/** Cycles through `EMOTION_EXPRESSION_POOL[emotion]` by occurrence index (0,
 * 1, 2, 0, 1, 2, ...) so the Nth time a given emotion appears in a pack gets
 * a genuinely different {expression,pose} pair from the (N-1)th time,
 * instead of the single fixed pair every prior phase used. Falls back to
 * `EMOTION_EXPRESSION_MAP` for any emotion somehow missing from the pool
 * (shouldn't happen — every EmotionId has a pool entry above — but keeps
 * this total instead of throwing). */
export function resolveExpressionForOccurrence(
  emotion: EmotionId,
  occurrence: number
): { expression: ExpressionId; pose: PoseId } {
  const pool = EMOTION_EXPRESSION_POOL[emotion];
  if (!pool || pool.length === 0) {
    return EMOTION_EXPRESSION_MAP[emotion] ?? EMOTION_EXPRESSION_MAP.custom;
  }
  return pool[occurrence % pool.length];
}

/**
 * Phase 3.3 §8 — bridges `EmotionId` to the new `IntentId` "Action" concept.
 * Not every emotion has an obvious matching intent (e.g. "ok"/"shy" don't
 * clearly imply a specific action beyond their pose) — those are left
 * `undefined` and the prompt builder simply omits the Action clause for
 * them, which is correct: Action is meant to add specificity, not be forced
 * where it doesn't fit.
 */
export const EMOTION_INTENT_MAP: Partial<Record<EmotionId, IntentId>> = {
  sawadee: "greeting_warmly",
  thankyou: "thanking",
  hungry: "hungry_eating",
  fight: "fighting_spirit",
  goodnight: "going_to_sleep",
  miss: "missing_someone",
  haha: "laughing_hard",
  happy: "celebrating",
  // "sulk" (งอน) has no clean IntentId match — deliberately left unmapped
  // rather than forcing a poor-fit action onto it.
};
