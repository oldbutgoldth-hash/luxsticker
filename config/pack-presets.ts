import type { EmotionId, PackPresetId } from "@/types";

/**
 * Preset packs (spec §8) — quick-start text sets. Each entry pairs the
 * exact phrase with the closest existing EmotionId (styles/emotion-presets.ts)
 * so the variation/decoration engines can react to it; the phrase itself is
 * stored verbatim and stays editable per plan item afterwards.
 */
export interface PackPresetItem {
  text: string;
  emotion: EmotionId;
}

export interface PackPresetDefinition {
  id: PackPresetId;
  label: string;
  labelTh: string;
  items: PackPresetItem[];
}

export const PACK_PRESETS: Record<Exclude<PackPresetId, "custom">, PackPresetDefinition> = {
  daily: {
    id: "daily",
    label: "Daily Life",
    labelTh: "ชีวิตประจำวัน",
    items: [
      { text: "สวัสดี", emotion: "sawadee" },
      { text: "ขอบคุณ", emotion: "thankyou" },
      { text: "โอเค", emotion: "ok" },
      { text: "ได้เลย", emotion: "ok" },
      { text: "555", emotion: "haha" },
      { text: "ไม่เป็นไร", emotion: "ok" },
      { text: "เดี๋ยวมา", emotion: "custom" },
      { text: "ไปก่อนนะ", emotion: "custom" },
      { text: "ฝันดี", emotion: "goodnight" },
    ],
  },
  love: {
    id: "love",
    label: "Love",
    labelTh: "ความรัก",
    items: [
      { text: "รักนะ", emotion: "love" },
      { text: "คิดถึง", emotion: "miss" },
      { text: "เขิน", emotion: "shy" },
      { text: "งอนแล้วนะ", emotion: "sulk" },
      { text: "ขอโทษ", emotion: "custom" },
      { text: "กอดหน่อย", emotion: "love" },
      { text: "อยู่ไหน", emotion: "custom" },
      { text: "อยากเจอ", emotion: "miss" },
      { text: "ฝันดี", emotion: "goodnight" },
    ],
  },
  funny: {
    id: "funny",
    label: "Funny",
    labelTh: "ตลก",
    items: [
      { text: "555", emotion: "haha" },
      { text: "ฮาแล้ว", emotion: "haha" },
      { text: "อะไรเนี่ย", emotion: "custom" },
      { text: "โอ๊ย", emotion: "custom" },
      { text: "ไม่ไหว", emotion: "tired" },
      { text: "หิว", emotion: "hungry" },
      { text: "ง่วง", emotion: "sleepy" },
      { text: "ปวดหัว", emotion: "tired" },
      { text: "ช่วยด้วย", emotion: "custom" },
    ],
  },
  work: {
    id: "work",
    label: "Work",
    labelTh: "งาน",
    items: [
      { text: "รับทราบ", emotion: "ok" },
      { text: "โอเคครับ", emotion: "ok" },
      { text: "เดี๋ยวจัดการให้", emotion: "fight" },
      { text: "กำลังทำ", emotion: "fight" },
      { text: "เรียบร้อยครับ", emotion: "happy" },
      { text: "ขอบคุณครับ", emotion: "thankyou" },
      { text: "รอสักครู่", emotion: "custom" },
      { text: "ได้ครับ", emotion: "ok" },
      { text: "ส่งแล้วครับ", emotion: "happy" },
    ],
  },
};

export const PACK_PRESET_ORDER: PackPresetId[] = ["daily", "love", "funny", "work", "custom"];
