import type { FontStyleId } from "@/types";

/**
 * Typography category catalog (Phase 3.1 spec §9/§10/§11) — the user picks a
 * *category* ("น่ารัก", "คาวาอี้", "คอมมิค", ...), never a raw font file
 * directly, so a category's underlying font can be swapped/upgraded later by
 * editing exactly one entry here (spec §11: "Architecture ต้องรองรับการเพิ่ม
 * Font ใหม่ในอนาคต"). `"auto"` has no entry of its own — it's resolved to a
 * concrete category by config/font-emotion-matching.ts before this catalog
 * is consulted.
 *
 * All font families are Google Fonts (SIL Open Font License 1.1, commercial
 * use permitted) loaded via the existing runtime <link> approach in
 * lib/fonts.ts — see /docs/font-licenses.md for the full per-font record
 * (spec §33: never ship a font without checking its license first).
 */
export interface FontCatalogEntry {
  id: Exclude<FontStyleId, "auto">;
  labelTh: string;
  /** CSS var reference, resolved to a real family name at draw time by
   * lib/fonts.ts's resolveCssFontVar() — matches the pattern StylePreset's
   * `fontFamily` already uses. */
  fontFamily: string;
  fontWeight: number;
  description: string;
}

export const FONT_CATALOG: Record<Exclude<FontStyleId, "auto">, FontCatalogEntry> = {
  kawaii: {
    id: "kawaii",
    labelTh: "คาวาอี้",
    fontFamily: "var(--font-mali)",
    fontWeight: 600,
    description: "Mali — โค้งมน หวาน น่ารัก",
  },
  cute: {
    id: "cute",
    labelTh: "น่ารัก",
    fontFamily: "var(--font-mitr)",
    fontWeight: 500,
    description: "Mitr — มน อบอุ่น อ่านง่าย",
  },
  comic: {
    id: "comic",
    labelTh: "คอมมิค",
    fontFamily: "var(--font-kanit)",
    fontWeight: 800,
    description: "Kanit ตัวหนา — หนัก มี Energy",
  },
  handwritten: {
    id: "handwritten",
    labelTh: "ลายมือ",
    fontFamily: "var(--font-charmonman)",
    fontWeight: 700,
    description: "Charmonman — เหมือนลายมือ อบอุ่น",
  },
  bold: {
    id: "bold",
    labelTh: "ตัวหนา",
    fontFamily: "var(--font-kanit)",
    fontWeight: 900,
    description: "Kanit น้ำหนักสูงสุด — ตัวใหญ่ อ่านง่าย",
  },
  brush: {
    id: "brush",
    labelTh: "พู่กัน",
    fontFamily: "var(--font-chonburi)",
    fontWeight: 400,
    description: "Chonburi — ตัวหนาสไตล์แปรง/ป้าย (ใกล้เคียงพู่กันที่สุดในฟอนต์ไทยที่มี License ใช้เชิงพาณิชย์ได้)",
  },
  minimal: {
    id: "minimal",
    labelTh: "มินิมอล",
    fontFamily: "var(--font-prompt)",
    fontWeight: 400,
    description: "Prompt น้ำหนักปกติ — เรียบ สะอาด",
  },
  luxury: {
    id: "luxury",
    labelTh: "หรู",
    fontFamily: "var(--font-taviraj)",
    fontWeight: 500,
    description: "Taviraj — เซอริฟ หรู Elegant",
  },
};

export const FONT_STYLE_ORDER: Exclude<FontStyleId, "auto">[] = [
  "kawaii",
  "cute",
  "comic",
  "handwritten",
  "bold",
  "brush",
  "minimal",
  "luxury",
];
