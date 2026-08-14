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

export interface ValidationResult {
  passed: boolean;
  checks: ValidationCheck[];
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
