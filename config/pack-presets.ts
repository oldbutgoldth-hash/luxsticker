import type { ColorThemeId, DecorationCategoryId, EmotionId, FontStyleId, PackPresetId, StyleId } from "@/types";

/**
 * Preset packs (spec §8, extended Phase 3.1 §31) — quick-start text sets.
 * Each entry pairs the exact phrase with the closest existing EmotionId
 * (styles/emotion-presets.ts) so the variation/decoration engines can react
 * to it; the phrase itself is stored verbatim and stays editable per plan
 * item afterwards.
 *
 * Phase 3.1 adds a `design` bundle per preset (spec §31's exact pairings —
 * "Cute Pack = Cartoon + Kawaii Font + Pastel + Heart/Sparkle", etc.) so
 * picking a preset also seeds the pack's Style/Font/Color/Decoration
 * choices, not just its text content. `design` is optional — omitted here
 * would mean "don't touch the pack's existing style/font/color", which
 * doesn't apply to any preset below (every preset now has one), but keeps
 * the type honest about what's actually required.
 */
export interface PackPresetItem {
  text: string;
  emotion: EmotionId;
}

export interface PackPresetDesign {
  style: StyleId;
  fontStyle: FontStyleId;
  colorTheme: ColorThemeId;
  decorationCategory: DecorationCategoryId;
}

export interface PackPresetDefinition {
  id: PackPresetId;
  label: string;
  labelTh: string;
  items: PackPresetItem[];
  design: PackPresetDesign;
}

export const PACK_PRESETS: Record<Exclude<PackPresetId, "custom">, PackPresetDefinition> = {
  daily: {
    id: "daily",
    label: "Daily Life",
    labelTh: "ชีวิตประจำวัน",
    design: { style: "real", fontStyle: "minimal", colorTheme: "auto", decorationCategory: "auto" },
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
  // Spec §31 "Love Pack": Kawaii + Cute Font + Pink + Heart.
  love: {
    id: "love",
    label: "Love",
    labelTh: "ความรัก",
    design: { style: "kawaii", fontStyle: "cute", colorTheme: "pink", decorationCategory: "love" },
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
  // Spec §31 "Funny Pack": Cartoon + Comic Font + Bright + Comic Effects.
  funny: {
    id: "funny",
    label: "Funny",
    labelTh: "ตลก",
    design: { style: "comic", fontStyle: "comic", colorTheme: "yellow", decorationCategory: "funny" },
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
  // Spec §31 "Work Pack": Real Photo/Cartoon + Bold + Minimal + Clean.
  work: {
    id: "work",
    label: "Work",
    labelTh: "งาน",
    design: { style: "real", fontStyle: "bold", colorTheme: "mono", decorationCategory: "auto" },
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
  // Spec §31 "Cute Pack": Cartoon + Kawaii Font + Pastel + Heart/Sparkle.
  cute: {
    id: "cute",
    label: "Cute",
    labelTh: "น่ารัก",
    design: { style: "chibi", fontStyle: "kawaii", colorTheme: "pastel", decorationCategory: "love" },
    items: [
      { text: "หวัดดีจ้า", emotion: "sawadee" },
      { text: "น่ารักเนอะ", emotion: "happy" },
      { text: "ขอบคุณนะ", emotion: "thankyou" },
      { text: "เขินอ่ะ", emotion: "shy" },
      { text: "รักเลย", emotion: "love" },
      { text: "งอนแง้ว", emotion: "sulk" },
      { text: "หิวจัง", emotion: "hungry" },
      { text: "ง่วงแระ", emotion: "sleepy" },
      { text: "ฝันดีน้า", emotion: "goodnight" },
    ],
  },
  // Spec §31 "Travel Pack": Cartoon + Playful + Blue/Yellow + Travel Decoration.
  travel: {
    id: "travel",
    label: "Travel",
    labelTh: "ท่องเที่ยว",
    design: { style: "cartoon", fontStyle: "bold", colorTheme: "blue", decorationCategory: "travel" },
    items: [
      { text: "ไปเที่ยวกัน", emotion: "happy" },
      { text: "ถึงแล้ว!", emotion: "happy" },
      { text: "สวยมาก", emotion: "happy" },
      { text: "หิวละ", emotion: "hungry" },
      { text: "เหนื่อยจัง", emotion: "tired" },
      { text: "ถ่ายรูปหน่อย", emotion: "custom" },
      { text: "ไปต่อ!", emotion: "fight" },
      { text: "คิดถึงบ้าน", emotion: "miss" },
      { text: "ฝันดี", emotion: "goodnight" },
    ],
  },
};

export const PACK_PRESET_ORDER: PackPresetId[] = ["daily", "love", "funny", "work", "cute", "travel", "custom"];
