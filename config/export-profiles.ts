// ============================================================================
// Export Profiles — target-platform packaging rules.
//
// crop-engine / export-normalizer / validation-engine / export-engine all
// take a profile object as a parameter (never a hardcoded constant), so
// adding a new target later means adding one object to EXPORT_PROFILES and
// nothing else. Phase 1.1 only ships LINE_STICKER; the other ids are
// reserved for Phase 2+ (sticker main image, chat-tab icon, big stickers,
// animated stickers).
// ============================================================================

export interface ExportProfile {
  id: ExportProfileId;
  label: string;
  format: "png";
  maxWidth: number;
  maxHeight: number;
  requireEvenDimensions: boolean;
  maxFileSizeBytes: number;
  transparentBackground: boolean;
  /** Minimum guaranteed transparent margin around content, in px. */
  minPaddingPx: number;
}

export type ExportProfileId =
  | "LINE_STICKER"
  | "LINE_MAIN"
  | "LINE_CHAT_TAB"
  | "LINE_BIG_STICKER"
  | "LINE_ANIMATED";

/** LINE Creators Market individual sticker requirements. */
export const LINE_STICKER: ExportProfile = {
  id: "LINE_STICKER",
  label: "LINE Sticker",
  format: "png",
  maxWidth: 370,
  maxHeight: 320,
  requireEvenDimensions: true,
  maxFileSizeBytes: 1024 * 1024, // 1 MB
  transparentBackground: true,
  minPaddingPx: 10,
};

// Reserved for later phases — intentionally not implemented yet (spec §2:
// "Phase นี้ทำเฉพาะ LINE_STICKER ก่อน"). Registering one is a one-line change.
export const EXPORT_PROFILES: Partial<Record<ExportProfileId, ExportProfile>> = {
  LINE_STICKER,
};

export const DEFAULT_EXPORT_PROFILE: ExportProfile = LINE_STICKER;
