// ============================================================================
// LUXSTICKER AI — Core domain types
// Single source of truth for the sticker "project" data model. Every engine
// (outline / text / decoration / composition / crop / validation / export)
// reads and writes these shapes — no engine keeps private state.
// ============================================================================

export type StyleId = "cute" | "funny" | "kawaii" | "real";

export const STYLE_IDS: StyleId[] = ["cute", "funny", "kawaii", "real"];

/** Emotion presets required by spec section 6, plus custom free text. */
export type EmotionId =
  | "sawadee" // สวัสดี
  | "thankyou" // ขอบคุณ
  | "ok" // โอเค
  | "love" // รักนะ
  | "miss" // คิดถึง
  | "haha" // 555
  | "happy" // ดีใจ
  | "shy" // เขิน
  | "sulk" // งอน
  | "angry" // โกรธ
  | "cry" // ร้องไห้
  | "hungry" // หิว
  | "sleepy" // ง่วง
  | "tired" // เหนื่อย
  | "fight" // สู้ๆ
  | "goodnight" // ฝันดี
  | "custom";

export type OutlineStyle = "white" | "black" | "soft-white" | "thick" | "double";

export interface OutlineConfig {
  style: OutlineStyle;
  /** Outline thickness in canvas px, independently adjustable in the editor. */
  widthPx: number;
  /** Secondary color used only by the "double" style (outer ring). */
  secondaryColor?: string;
}

export type LayerKind = "character" | "text" | "decoration";

/** Shared transform every editable layer has — lets the editor use one
 * generic drag/resize/rotate interaction system for every layer kind. */
export interface LayerTransform {
  x: number;
  y: number;
  scale: number;
  /** Radians. */
  rotation: number;
}

interface BaseLayer extends LayerTransform {
  id: string;
  kind: LayerKind;
  zIndex: number;
}

export interface CharacterLayer extends BaseLayer {
  kind: "character";
  /** Original, untouched upload — kept forever, never mutated (spec §4). */
  originalUrl: string;
  /** Background-removed, transparent PNG data URL used for rendering. */
  cutoutUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  /** True if background removal failed and we fell back to the raw image. */
  isFallbackCutout: boolean;
}

export interface TextLayer extends BaseLayer {
  kind: "text";
  text: string;
  fontFamily: string;
  fontSizePx: number;
  fontWeight: number;
  color: string;
  outlineColor: string;
  outlineWidthPx: number;
  shadow: boolean;
}

export interface DecorationLayer extends BaseLayer {
  kind: "decoration";
  /** Emoji glyph used as the decoration graphic. */
  glyph: string;
}

export type AnyLayer = CharacterLayer | TextLayer | DecorationLayer;

export interface CanvasSize {
  width: number;
  height: number;
}

export interface StickerProject {
  id: string;
  style: StyleId;
  emotion: EmotionId;
  character: CharacterLayer | null;
  text: TextLayer | null;
  decorations: DecorationLayer[];
  outline: OutlineConfig;
  /** Working canvas before auto-crop. Auto-crop produces the final export size. */
  canvasSize: CanvasSize;
}

export interface ValidationCheck {
  id: string;
  label: string;
  passed: boolean;
  message: string;
  autoFixed?: boolean;
}

export interface ValidationMeta {
  width: number;
  height: number;
  fileSizeBytes: number;
}

export interface ValidationResult {
  passed: boolean;
  checks: ValidationCheck[];
  /** Concrete numbers behind the checks (dimensions/file size of the PNG
   * that was actually validated) — used by the export status UI so it
   * doesn't have to re-derive them (spec Phase 1.1 §14/§15). */
  meta?: ValidationMeta;
}

// ----------------------------------------------------------------------------
// Sticker Pack data model (Phase 2 — Sticker Pack Generator). Everything
// below sits on TOP of the Phase 1 render pipeline: a PackStickerItem's
// `project` is a completely normal StickerProject, rendered by the exact
// same runGenerationPipeline/refreshAfterEdit used by the single-sticker
// flow (lib/pipeline.ts, untouched). Nothing here changes how one sticker
// gets rendered — it only orchestrates rendering many of them from one
// shared CharacterMaster.
// ----------------------------------------------------------------------------

export type PackSize = 8 | 16 | 24 | 32 | 40;

export const PACK_SIZES: PackSize[] = [8, 16, 24, 32, 40];

/** Spec §29 — the pack's lifecycle state. */
export type PackStatus =
  | "DRAFT"
  | "GENERATING"
  | "REVIEW"
  | "PARTIAL_READY"
  | "READY"
  | "EXPORTING"
  | "EXPORTED"
  | "ERROR";

/** Spec §11 — named composition presets the variation engine picks between
 * per sticker (chosen by emotion affinity, not randomly). */
export type CompositionPresetId =
  | "CENTER_TOP_TEXT"
  | "CENTER_BOTTOM_TEXT"
  | "LEFT_CHARACTER_RIGHT_TEXT"
  | "RIGHT_CHARACTER_LEFT_TEXT"
  | "BIG_CHARACTER_TOP_TEXT"
  | "SMALL_CHARACTER_BIG_TEXT"
  | "DIAGONAL"
  | "COMIC_BURST"
  | "HEART_FRAME"
  | "MINIMAL";

export type DecorationDensity = "none" | "low" | "normal" | "high";

export type PackPresetId = "daily" | "love" | "funny" | "work" | "custom";

/** One row in the editable Sticker Plan (spec §6/§7) — text + intent, not
 * yet rendered. Rendering a plan item produces a PackStickerItem. */
export interface StickerPlanItem {
  id: string;
  order: number;
  text: string;
  emotion: EmotionId;
  /** Defaults to the pack's overall style; overridable per item. */
  styleOverride?: StyleId;
  compositionPresetId: CompositionPresetId;
  decorationDensity: DecorationDensity;
}

export type PackStickerStatus = "pending" | "generating" | "ready" | "needs_fix" | "error";

/** One rendered sticker inside a pack. `project` is a normal StickerProject —
 * the exact same shape the single-sticker editor already knows how to
 * display and edit (spec §20: "คลิก Sticker ใดก็ได้ เปิด Editor เดิม"). */
export interface PackStickerItem {
  id: string;
  planItemId: string;
  order: number;
  filename: string;
  project: StickerProject | null;
  finalCanvas: HTMLCanvasElement | null;
  validation: ValidationResult | null;
  status: PackStickerStatus;
  /** Auto-fix/regenerate attempts so far — surfaced instead of retrying forever. */
  attempts: number;
}

/** Spec §4/§5 — the single identity source every sticker in the pack is
 * built from. `dominantColors` is real, programmatic pixel sampling of the
 * cutout (spec §35: no fake AI) — not an AI-detected face/hair/clothing
 * attribute set, which this project does not have in Phase 2. Character
 * consistency instead comes from every sticker reusing this exact
 * `cutoutUrl` — background removal only ever runs once per pack (spec §15). */
export interface CharacterMaster {
  id: string;
  originalUrl: string;
  cutoutUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  isFallbackCutout: boolean;
  dominantColors: string[];
  createdAt: string;
}

export interface StickerPack {
  id: string;
  name: string;
  size: PackSize;
  presetId: PackPresetId;
  style: StyleId;
  language: "th" | "en";
  status: PackStatus;
  character: CharacterMaster | null;
  plan: StickerPlanItem[];
  stickers: PackStickerItem[];
  createdAt: string;
  updatedAt: string;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
