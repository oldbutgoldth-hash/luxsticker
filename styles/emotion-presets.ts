import type { EmotionId } from "@/types";

/**
 * The 16 required emotions (spec §6) + "custom" for free text.
 * Each maps to default Thai text and a decoration glyph that biases the
 * decoration engine (combined with the chosen Style's own palette).
 */
export interface EmotionPreset {
  id: EmotionId;
  labelTh: string;
  defaultText: string;
  emphasisGlyph: string | null;
}

export const EMOTION_PRESETS: EmotionPreset[] = [
  { id: "sawadee", labelTh: "สวัสดี", defaultText: "สวัสดี", emphasisGlyph: "✨" },
  { id: "thankyou", labelTh: "ขอบคุณ", defaultText: "ขอบคุณนะ", emphasisGlyph: "💕" },
  { id: "ok", labelTh: "โอเค", defaultText: "โอเค", emphasisGlyph: "✨" },
  { id: "love", labelTh: "รักนะ", defaultText: "รักนะ", emphasisGlyph: "❤️" },
  { id: "miss", labelTh: "คิดถึง", defaultText: "คิดถึงนะ", emphasisGlyph: "💕" },
  { id: "haha", labelTh: "555", defaultText: "555", emphasisGlyph: "💥" },
  { id: "happy", labelTh: "ดีใจ", defaultText: "ดีใจจัง", emphasisGlyph: "🎉" },
  { id: "shy", labelTh: "เขิน", defaultText: "เขินอ่ะ", emphasisGlyph: "💕" },
  { id: "sulk", labelTh: "งอน", defaultText: "งอนแล้วนะ", emphasisGlyph: "💢" },
  { id: "angry", labelTh: "โกรธ", defaultText: "โกรธแล้ว!", emphasisGlyph: "💢" },
  { id: "cry", labelTh: "ร้องไห้", defaultText: "ฮือออ", emphasisGlyph: "😭" },
  { id: "hungry", labelTh: "หิว", defaultText: "หิวข้าว", emphasisGlyph: "💦" },
  { id: "sleepy", labelTh: "ง่วง", defaultText: "ง่วงแล้ว", emphasisGlyph: "💨" },
  { id: "tired", labelTh: "เหนื่อย", defaultText: "เหนื่อยจัง", emphasisGlyph: "💦" },
  { id: "fight", labelTh: "สู้ๆ", defaultText: "สู้ๆนะ", emphasisGlyph: "💥" },
  { id: "goodnight", labelTh: "ฝันดี", defaultText: "ฝันดีนะ", emphasisGlyph: "✨" },
  { id: "custom", labelTh: "กำหนดเอง", defaultText: "", emphasisGlyph: null },
];

export function getEmotionPreset(id: EmotionId): EmotionPreset {
  return EMOTION_PRESETS.find((e) => e.id === id) ?? EMOTION_PRESETS[EMOTION_PRESETS.length - 1];
}
