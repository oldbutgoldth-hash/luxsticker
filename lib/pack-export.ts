import JSZip from "jszip";
import type { StickerPack } from "@/types";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Monotonic per-session call counter. `Date`'s millisecond field alone is
 * NOT sufficient for uniqueness — a synchronous double-click, or two exports
 * fired in the same tick, can land in the same millisecond (verified: 1000
 * back-to-back calls produced 998 collisions using only YYYYMMDD-HHMMSSmmm).
 * Appending a strictly-increasing counter guarantees every filename this
 * running app instance ever produces is unique, independent of clock
 * resolution or call timing (spec §25/TEST 13/TEST 14).
 */
let exportCallCounter = 0;

/**
 * Filename for the in-app "Export Pack" download (spec §23/§25 naming
 * spirit — versioned + timestamped so the browser never silently reuses a
 * name). Deliberately distinct from this project's own dev-build source
 * ZIPs (`luxsticker-ai-vX.Y.Z-buildNNN-...zip`, produced once per
 * development phase for code review) — this one is an end-user artifact:
 * a folder of PNGs downloaded from inside the running app, not the app's
 * source code.
 */
export function packExportFilename(pack: StickerPack): string {
  const now = new Date();
  const stamp = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}-${pad2(now.getHours())}${pad2(
    now.getMinutes()
  )}${pad2(now.getSeconds())}`;
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  // Not modulo'd — a true monotonic counter never wraps, so it can never
  // reintroduce a collision no matter how many exports happen in one
  // millisecond (unlike a fixed-width wrapped sequence).
  const seq = String(exportCallCounter++).padStart(3, "0");
  return `luxsticker-ai-pack-${pack.presetId}-${pack.size}stickers-${stamp}${ms}-${seq}.zip`;
}

export interface PackExportResult {
  filename: string;
  stickerCount: number;
}

/** Phase 3.3 §23 — true when ANY sticker in the pack used the Mock AI
 * provider (`aiMetadata.mock === true`). Exported packs built this way must
 * never be indistinguishable from a real-AI export — see the manifest line
 * this drives below, and the confirmation gate in PackGeneratorApp.tsx's
 * `handleExport` that surfaces this to the user BEFORE the ZIP downloads. */
export function packUsedMockAi(pack: StickerPack): boolean {
  return pack.stickers.some((s) => s.aiMetadata?.mock === true);
}

function buildPackManifest(pack: StickerPack, appVersion: string): string {
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const sorted = [...pack.stickers].sort((a, b) => a.order - b.order);
  const usedMock = packUsedMockAi(pack);
  const usedAi = sorted.some((s) => s.characterMode === "ai_expression");
  return [
    "LUXSTICKER AI",
    "Project: LUXSTICKER AI",
    `Version: ${appVersion}`,
    `Date: ${now}`,
    `Pack Name: ${pack.name}`,
    `Pack Size: ${pack.size}`,
    `Style: ${pack.style}`,
    `Preset: ${pack.presetId}`,
    `Validation: PASS (${sorted.length}/${sorted.length} READY)`,
    // Phase 3.3 §23/§24 — an honest, unambiguous line about how the
    // artwork was actually produced, always present (not just when true)
    // so a reader never has to infer AI provenance from absence of a line.
    usedMock
      ? "AI Source: MOCK — NO AI (development/testing build; character artwork is the unmodified original photo, not AI-generated)"
      : usedAi
        ? "AI Source: Real AI Expression/Cartoon Engine (see per-sticker metadata)"
        : "AI Source: not used (original character only)",
    "",
    "Stickers:",
    ...sorted.map((s) => `  ${s.filename} - ${s.project?.text?.text ?? ""}`.trimEnd()),
  ].join("\n");
}

/**
 * Pack Export (spec §23/§24/§26/§27). Every PNG is read straight off each
 * sticker's already-normalized, already-validated `finalCanvas` — never a
 * raw canvas — and export is refused outright unless every sticker's status
 * is "ready" (spec §19: "ห้าม Export Final ZIP จนกว่าทุกภาพจะผ่าน"). The ZIP
 * itself is only ever generated once validation has already passed, so it
 * is an immutable, correct-by-construction build artifact (spec §27).
 *
 * Phase 3.3 §23 adds a second gate: exporting a pack that used the Mock AI
 * provider requires the caller to pass `acknowledgeMockAi: true` (the UI
 * does this via a confirm dialog right before calling this function) — a
 * pack built under AI_MODE=mock can never be exported with the same silent,
 * one-click flow as a real-AI pack.
 */
export async function exportPackAsZip(
  pack: StickerPack,
  appVersion: string,
  options: { acknowledgeMockAi?: boolean } = {}
): Promise<PackExportResult> {
  const notReady = pack.stickers.filter((s) => s.status !== "ready" || !s.finalCanvas);
  if (notReady.length > 0) {
    throw new Error(`มีสติ๊กเกอร์ที่ยังไม่ผ่านการตรวจสอบ ${notReady.length} ภาพ ต้องแก้ให้ผ่านก่อน Export`);
  }
  if (packUsedMockAi(pack) && !options.acknowledgeMockAi) {
    throw new Error("แพ็คนี้ใช้ Mock AI (AI_MODE=mock) — ภาพตัวละครยังไม่ใช่ผล AI จริง ต้องยืนยันก่อน Export");
  }

  const zip = new JSZip();
  const sorted = [...pack.stickers].sort((a, b) => a.order - b.order);
  for (const sticker of sorted) {
    const blob = await new Promise<Blob | null>((resolve) => sticker.finalCanvas!.toBlob(resolve, "image/png"));
    if (!blob) throw new Error(`ไม่สามารถสร้างไฟล์ PNG สำหรับ ${sticker.filename} ได้`);
    zip.file(sticker.filename, blob);
  }
  zip.file("BUILD_INFO.txt", buildPackManifest(pack, appVersion));

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const filename = packExportFilename(pack);

  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);

  return { filename, stickerCount: sorted.length };
}
