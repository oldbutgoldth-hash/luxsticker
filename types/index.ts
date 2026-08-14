// ============================================================================
// LUXSTICKER AI — Core domain types
// Single source of truth for the sticker "project" data model. Every engine
// (outline / text / decoration / composition / crop / validation / export)
// reads and writes these shapes — no engine keeps private state.
// ============================================================================

/**
 * Phase 3.1 §3/§4 — extended from Phase 1/2's original 4 decoration/text
 * presets (cute/funny/kawaii/real) to also cover the 6 "Character Art
 * Style" choices spec'd for the Style panel: Real Photo (`real`), Cartoon
 * (`cartoon`), Kawaii (`kawaii` — already existed), Chibi (`chibi`), Comic
 * (`comic`), Hand Drawn (`hand_drawn`). `cute`/`funny` are kept for backward
 * compatibility with existing saved packs/projects — nothing is removed or
 * renamed (spec §1: "ห้ามรื้อระบบเดิม") — but the new Style picker only
 * surfaces the 6 spec'd choices (see STYLE_ORDER_V2 in styles/style-presets.ts).
 */
export type StyleId = "cute" | "funny" | "kawaii" | "real" | "cartoon" | "chibi" | "comic" | "hand_drawn";

export const STYLE_IDS: StyleId[] = ["cute", "funny", "kawaii", "real", "cartoon", "chibi", "comic", "hand_drawn"];

/** Spec §3 — which of the two top-level pipelines a given StyleId belongs
 * to. Only `real` is Mode A (no AI art transformation, background removal +
 * optional AI expression/pose only); every other style is Mode B (AI
 * transforms the character into that art style, when AI is enabled). */
export function isRealPhotoStyle(style: StyleId): boolean {
  return style === "real";
}

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

// ----------------------------------------------------------------------------
// Phase 3.1 — Typography / Color / Decoration "category" systems (spec §9-30).
// Each is a small, independently-selectable dimension on top of StyleId, all
// additive: a project/plan-item/pack that never sets these behaves exactly
// as before (undefined -> resolved to a sensible default at render time).
// ----------------------------------------------------------------------------

/** Spec §10/§30 — the 8 Font Style categories the Typography panel offers,
 * plus "auto" (system picks per spec §12's emotion matching). Users pick a
 * *category*, never a raw font file, so new fonts can be swapped into a
 * category later (config/font-catalog.ts) without changing this type. */
export type FontStyleId = "auto" | "kawaii" | "cute" | "comic" | "handwritten" | "bold" | "brush" | "minimal" | "luxury";

export const FONT_STYLE_IDS: FontStyleId[] = [
  "auto",
  "kawaii",
  "cute",
  "comic",
  "handwritten",
  "bold",
  "brush",
  "minimal",
  "luxury",
];

/** Spec §26 — color theme presets, plus "auto" (resolved from Style +
 * Emotion, spec §26: "Auto ต้องเลือกตาม Emotion + Style"). */
export type ColorThemeId =
  | "auto"
  | "pink"
  | "pastel"
  | "purple"
  | "blue"
  | "mint"
  | "yellow"
  | "rainbow"
  | "mono"
  | "black_white";

export const COLOR_THEME_IDS: ColorThemeId[] = [
  "auto",
  "pink",
  "pastel",
  "purple",
  "blue",
  "mint",
  "yellow",
  "rainbow",
  "mono",
  "black_white",
];

/** Spec §16/§30 — decoration categories (Love/Happy/Sad/Angry/Hungry(Food)/
 * Travel/Sleep, plus "Funny" from the UI panel list in §30), plus "auto"
 * (resolved from the sticker's Emotion). */
export type DecorationCategoryId = "auto" | "love" | "happy" | "sad" | "angry" | "hungry" | "travel" | "sleep" | "funny";

export const DECORATION_CATEGORY_IDS: DecorationCategoryId[] = [
  "auto",
  "love",
  "happy",
  "sad",
  "angry",
  "hungry",
  "travel",
  "sleep",
  "funny",
];

/** Spec §14 — trendy text placement/treatment variants so a pack doesn't put
 * text in the same spot on every sticker. `large_top`/`large_left`/
 * `large_right`/`bottom`/`diagonal` are placement seeds the existing
 * composition engine already knows how to realize (see
 * config/text-composition-presets.ts); `curved`, `stacked`, and `mixed` are
 * genuinely new rendering treatments implemented in engines/text-engine. */
export type TextCompositionVariant =
  | "large_top"
  | "large_left"
  | "large_right"
  | "bottom"
  | "curved"
  | "diagonal"
  | "stacked"
  | "mixed";

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
  /** Spec Phase 3.1 §13 — additive text treatments on top of the existing
   * fill/outline/shadow. Both default to false/undefined so every existing
   * TextLayer (Phase 1-3) renders identically. */
  glow?: boolean;
  offsetShadow?: boolean;
  /** Spec §14 — which placement/treatment variant produced this layer's
   * position, purely informational for `curved`/`stacked`/`mixed` (the
   * engine needs to know which special render path to use); absent for
   * layers built before Phase 3.1 or that used a plain autoCompose position. */
  textComposition?: TextCompositionVariant;
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
  /** Phase 3.1 — independently-selectable typography/color/decoration
   * dimensions layered on top of `style`. All optional: absent means "use
   * the Style preset's own defaults", exactly Phase 1-3 behavior. */
  fontStyle?: FontStyleId;
  colorTheme?: ColorThemeId;
  decorationCategory?: DecorationCategoryId;
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
  | "MINIMAL"
  // Phase 3.1 §18 — added shot-framing variety not covered by the 10 presets
  // above (which vary character X/Y position + text size, but not "how much
  // of the character is visible"). Named exactly per spec's list; the other
  // spec-listed names (PHOTO_LARGE, CHARACTER_LEFT, CENTER, TOP_TEXT, etc.)
  // are deliberately not duplicated as separate ids — they already map
  // 1:1 onto presets above (e.g. CHARACTER_LEFT === LEFT_CHARACTER_RIGHT_TEXT,
  // TOP_TEXT === CENTER_TOP_TEXT) and adding aliases would just fragment the
  // affinity tables without adding real visual variety.
  | "FULL_BODY"
  | "HALF_BODY"
  | "CLOSE_UP";

export type DecorationDensity = "none" | "low" | "normal" | "high";

/** Spec §31 adds "Cute Pack" and "Travel Pack" to Phase 2's original 4
 * (daily/love/funny/work) + custom. */
export type PackPresetId = "daily" | "love" | "funny" | "work" | "cute" | "travel" | "custom";

// ----------------------------------------------------------------------------
// AI Expression & Pose Engine (Phase 2.5). Everything below is additive on
// top of the Phase 2 pack model above — a plan item or pack sticker that
// never sets `expression`/`pose`/`aiStatus` behaves exactly as it did in
// Phase 2 (spec §1: "ห้ามรื้อ Phase 1 และ Phase 2").
// ----------------------------------------------------------------------------

/** Spec §9 — the 19 expressions the AI Expression Engine can target. Kept as
 * a distinct type from `EmotionId` (Phase 2's composition/decoration
 * variation key) because the spec spells out its own exact id list; a
 * mapping table (config/expression-presets.ts) bridges the two so existing
 * Phase 2 plan items keep working unchanged.
 *
 * Phase 3.3 §7 adds 4 more (confident/playful/relaxed/embarrassed) so the
 * catalog covers all 15 expressions the Phase 3.3 spec names by ID, on top
 * of the 19 Phase 2.5 already had (several overlap, e.g. spec's SURPRISED ~
 * existing "surprise", SAD/CRY/ANGRY/SLEEPY/HUNGRY already existed
 * verbatim) — nothing existing is renamed or removed. */
export type ExpressionId =
  | "greeting"
  | "thankyou"
  | "ok"
  | "happy"
  | "love"
  | "miss"
  | "sad"
  | "cry"
  | "angry"
  | "shy"
  | "tired"
  | "sleepy"
  | "hungry"
  | "excited"
  | "funny"
  | "sorry"
  | "fight"
  | "goodbye"
  | "surprise"
  | "confident"
  | "playful"
  | "relaxed"
  | "embarrassed";

/** Spec §10 — the pose vocabulary the AI Expression Engine can target.
 *
 * Phase 3.3 §6 adds 7 more (hand_on_cheek/sleeping/running/shy_pose/
 * surprised_pose/cover_mouth/looking_sideways) to reach parity with the
 * spec's named 15-pose list — several already existed under a different but
 * equivalent name (spec's POSE_WAI ~ existing "bow", POSE_THUMBS_UP ~
 * "thumbsup", POSE_HEART_HANDS ~ "heart_hands", POSE_HOLD_STOMACH ~
 * "hold_stomach", POSE_FIST_UP ~ "fist", POSE_JUMPING ~ "jump",
 * POSE_LAUGHING ~ "laugh") so those are NOT duplicated here. `shy_pose` /
 * `surprised_pose` are suffixed to avoid colliding with the existing
 * `ExpressionId` values `"shy"`/`"surprise"` (a pose and an expression are
 * different axes and can both apply to the same sticker at once). */
export type PoseId =
  | "wave"
  | "bow"
  | "thumbsup"
  | "laugh"
  | "heart_hands"
  | "hug_self"
  | "hold_stomach"
  | "yawn"
  | "fist"
  | "wipe_tears"
  | "cheer"
  | "invite"
  | "jump"
  | "clap"
  | "point"
  | "sit"
  | "stand"
  | "hand_on_cheek"
  | "sleeping"
  | "running"
  | "shy_pose"
  | "surprised_pose"
  | "cover_mouth"
  | "looking_sideways";

/**
 * Phase 3.3 §8 — "Sticker Intent," a concept distinct from `ExpressionId`.
 * An expression describes the FACE; an intent describes the ACTION/SITUATION
 * the character is depicted doing (e.g. actively eating vs. just looking
 * hungry) — it's what drives the "Action" clause in the AI prompt
 * (lib/expression-prompt-builder.ts) separately from the "Expression" and
 * "Pose" clauses, so a sticker can read as a small scene, not just a face +
 * a static gesture. Optional everywhere it's used — a plan item / emotion
 * that has no matching intent simply omits the Action clause from the
 * prompt (Phase 2/2.5/3/3.1 behavior unaffected). */
export type IntentId =
  | "hungry_eating"
  | "travel_ready"
  | "fighting_spirit"
  | "going_to_sleep"
  | "thanking"
  | "celebrating"
  | "apologizing"
  | "missing_someone"
  | "laughing_hard"
  | "greeting_warmly";

/** Spec §21 — per-sticker AI generation lifecycle, folded into
 * PackStickerItem alongside the existing PackStickerStatus. Left undefined
 * whenever AI Expressions are off for that sticker (Phase 2 behavior). */
export type AiGenerationStatus = "AI_PENDING" | "AI_GENERATING" | "AI_READY" | "AI_FAILED";

/** Which character image a sticker actually used — the AI-generated
 * expression, or (after a provider failure/fallback choice, spec §17) the
 * unmodified Character Master cutout, clearly labeled "Original Character
 * Mode" in the UI so nobody mistakes it for a successful AI generation. */
export type CharacterMode = "ai_expression" | "original_character";

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
  /** Phase 2.5 — only consulted when the pack's `useAiExpressions` toggle is
   * on. Derived from `emotion` by EMOTION_EXPRESSION_MAP when a plan item is
   * first built, but independently editable afterwards. */
  expression?: ExpressionId;
  pose?: PoseId;
  /** Phase 3.3 §8 — the action/situation this sticker depicts, layered on
   * top of `expression` (face) and `pose` (gesture). Optional; only
   * consulted by the AI prompt builder when present. */
  intent?: IntentId;
  /** Phase 3.3 §19/§20 — the last AIArtworkScore this plan item's rendered
   * sticker received, kept for debugging/inspection in the pack dashboard.
   * Not persisted as part of export. */
  lastArtworkScore?: AIArtworkScore;
  /** Phase 3.1 — per-item overrides of the pack's typography/color/
   * decoration/text-placement choices. Only meaningful when the pack isn't
   * locked (StickerPack.fontLocked / styleLocked) or when Manual Design mode
   * is on; ignored (falls back to the pack-level resolved value) otherwise. */
  fontStyleOverride?: FontStyleId;
  colorThemeOverride?: ColorThemeId;
  decorationCategoryOverride?: DecorationCategoryId;
  textCompositionOverride?: TextCompositionVariant;
}

export type PackStickerStatus = "pending" | "generating" | "ready" | "needs_fix" | "error" | "needs_ai";

/** Real, non-secret metadata about one AI Expression call (spec §5 output
 * shape) — surfaced in the UI so a mock result can never be mistaken for a
 * real one (spec §25). */
export interface ExpressionGenerationMetadata {
  provider: string;
  model: string;
  generationTimeMs: number;
  /** True when this came from MockExpressionProvider — the UI must show
   * "MOCK — NO AI" whenever this is true, never "AI Generated". */
  mock: boolean;
}

/**
 * Phase 3.3 §19/§20 — a documented, HONEST quality heuristic run on every AI
 * result before it's allowed to become a sticker character layer. Spec §20
 * explicitly permits this to be a heuristic ("ไม่ต้องอ้างว่าเป็น AI Vision ที่
 * สมบูรณ์ ใช้เป็น Quality Heuristic") rather than true computer vision — this
 * app has no ML/OCR/pose-estimation model available (no network access to
 * fetch one, see /docs/ai-provider.md), so each sub-score is EITHER a real,
 * fully-deterministic check computed from actual pixel data, OR `null` with
 * `notEvaluatedReason` set when a category genuinely cannot be measured
 * without a vision model this app doesn't have. Never a fabricated number —
 * see lib/expression-pipeline.ts's `scoreAiArtwork()` for what each
 * non-null field actually measures.
 */
export interface AIArtworkScore {
  /** 0-1. REAL: alpha-channel bounding-box coverage (existing subject-exists
   * check, now surfaced as a score instead of a pass/fail only). */
  imageQuality: number;
  /** 0-1 or null. REAL (proxy): connected-opaque-region count on a
   * downsampled alpha grid — 1 large region scores high, 2+ well-separated
   * large regions (a real, if weak, signal for "more than one figure in
   * frame") score lower. Not a person-detector; documented as a proxy. */
  singleSubject: number | null;
  /** 0-1 or null. REAL (proxy): dominant-color-palette distance between the
   * AI output and the original character reference cutout (reuses the same
   * pixel-sampling utility as Character Master's `dominantColors`). Large
   * palette drift (e.g. hair/skin tone shifted) scores lower. This is a
   * COLOR proxy for identity, not true face-matching. */
  identityConsistency: number | null;
  /** null — pose adherence to the requested PoseId would require pose-
   * estimation ML this app doesn't have access to. Always `null` with
   * `notEvaluatedReason` set; kept as a field so the UI/report has a
   * consistent shape to render "not evaluated" for, honestly, instead of
   * silently omitting the category. */
  poseAdherence: number | null;
  /** null — same reasoning as `poseAdherence`, for whether the rendered
   * facial expression matches the requested ExpressionId. */
  expressionAdherence: number | null;
  /** null — duplicate/malformed-limb detection needs pose-estimation ML.
   * Always `null` with `notEvaluatedReason` set. */
  artifactFree: number | null;
  /** 0-1 or null. REAL (proxy): a conservative edge-density heuristic over
   * small rectangular patches (text tends to cluster as small, high-
   * contrast strokes) — NOT OCR, deliberately biased toward under-flagging
   * rather than rejecting real artwork on a false positive. */
  textContamination: number | null;
  /** Human-readable reasons for each `null` field above, keyed by field
   * name, so the UI/report can say WHY instead of just showing a dash. */
  notEvaluatedReason: Partial<Record<
    "singleSubject" | "identityConsistency" | "poseAdherence" | "expressionAdherence" | "artifactFree" | "textContamination",
    string
  >>;
}

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
  /** Phase 2.5 — undefined whenever this sticker was never routed through
   * the AI Expression Engine (Phase 2 behavior, toggle off). */
  aiStatus?: AiGenerationStatus;
  aiError?: string;
  aiMetadata?: ExpressionGenerationMetadata;
  characterMode?: CharacterMode;
  /** Phase 3.3 §19/§20 — set whenever this sticker's character image went
   * through the AI Expression Engine (mock or real); undefined for
   * non-AI/original-character stickers, same "undefined means not
   * applicable" convention as `aiStatus`. */
  artworkScore?: AIArtworkScore;
  /** Phase 3.3 §21 — how many bounded internal retry attempts
   * (`generateCharacterExpression`'s prompt/pose-refinement escalation) ran
   * before this sticker's final AI outcome. 0 = succeeded or failed on the
   * first try, no retry needed. */
  aiRetryCount?: number;
}

/** Spec §4/§5 — the single identity source every sticker in the pack is
 * built from. `dominantColors` is real, programmatic pixel sampling of the
 * cutout (spec §35: no fake AI) — not an AI-detected face/hair/clothing
 * attribute set, which this project does not have in Phase 2. Character
 * consistency instead comes from every sticker reusing this exact
 * `cutoutUrl` — background removal only ever runs once per pack (spec §15).
 * `characterHash` (Phase 2.5 §30) is a deterministic hash of the cutout's
 * pixel content, computed once here and reused as part of the AI Expression
 * cache key — it changes only when the user uploads a new photo. */
export interface CharacterMaster {
  id: string;
  originalUrl: string;
  cutoutUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  isFallbackCutout: boolean;
  dominantColors: string[];
  characterHash: string;
  createdAt: string;
}

/** The subset of a CharacterMaster needed to build a renderable
 * CharacterLayer (spec Phase 2.5 §32: "Single Sticker และ Pack ใช้ Engine
 * เดียวกัน"). `characterLayerFromMaster` accepts this narrower shape instead
 * of the full `CharacterMaster` so an AI-Expression-generated cutout (which
 * has no `id`/`dominantColors`/`characterHash` of its own — it's a
 * *variant* of the master, not a new master) can be passed through the exact
 * same function, unmodified. Every `CharacterMaster` structurally satisfies
 * this type already, so this is a purely additive, backward-compatible
 * widening of what that function accepts. */
export type CharacterSource = Pick<
  CharacterMaster,
  "originalUrl" | "cutoutUrl" | "naturalWidth" | "naturalHeight" | "isFallbackCutout"
>;

/** What an `AIImageProvider.generateExpression()` receives as the identity
 * reference (spec §3/§4) — a `CharacterMaster` satisfies this structurally,
 * but the single-sticker flow (which has no `CharacterMaster`) can build one
 * ad hoc from its own `CharacterLayer` + a computed hash, so the exact same
 * provider/prompt-builder/cache code works for both flows (spec §32). */
export type CharacterReferenceSource = CharacterSource & { characterHash: string };

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
  /** Phase 2.5 §24 — "[✓] Use AI Expressions" toggle. Default OFF: Phase 2's
   * Character Master + Composition/Text/Decoration variation is always a
   * fully-working fallback that never needs AI at all. Phase 3.1 extends its
   * meaning: when `style` is not "real", this same toggle also gates AI Art
   * Style transformation (spec §3 Mode B) — see transformToCartoon() in
   * lib/expression-pipeline.ts. */
  useAiExpressions: boolean;
  /** Phase 3.1 §23/§30 — pack-level typography/color/decoration choices.
   * "auto" resolves per-sticker from that sticker's Emotion (+ Style for
   * color); an explicit value is used for every sticker unless overridden
   * (spec §22/§23 "Style Lock"/"Font Lock" — locked by default, see below). */
  fontStyle: FontStyleId;
  colorTheme: ColorThemeId;
  decorationCategory: DecorationCategoryId;
  /** Spec §24/§25 — Auto Design picks Style/Font/Color/Decoration/Composition
   * consistently for the whole pack; Manual Design lets the user override
   * fields per plan item. Auto is the default (spec §24: opened first). */
  designMode: "auto" | "manual";
  /** Spec §22 — "ห้ามแต่ละ Sticker ดูเหมือนคนละ Style": when true (default),
   * every sticker uses the pack's own `style`, ignoring any
   * `StickerPlanItem.styleOverride`. */
  styleLocked: boolean;
  /** Spec §23 — same idea for `fontStyle`. */
  fontLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
