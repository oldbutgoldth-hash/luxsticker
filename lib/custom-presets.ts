import type { ColorThemeId, CompositionPresetId, DecorationCategoryId, FontStyleId, OutlineConfig, StyleId } from "@/types";

/**
 * "Save My Style" (Phase 3.1 spec §32) — a user-named bundle of
 * style/font/color/outline/decoration/composition choices they can re-apply
 * to a future pack. Spec §32 explicitly says no database is needed yet;
 * `localStorage` (guarded for SSR — `typeof window === "undefined"`) is the
 * right tool here: small, synchronous, per-browser, no backend required.
 * (Pack drafts already use IndexedDB via lib/pack-storage.ts for the much
 * larger job of persisting in-progress canvases; a preset is just a few
 * strings/numbers, so the heavier storage isn't needed for this.)
 */
export interface CustomPresetBundle {
  style: StyleId;
  fontStyle: FontStyleId;
  colorTheme: ColorThemeId;
  decorationCategory: DecorationCategoryId;
  outline: OutlineConfig;
  compositionPresetId?: CompositionPresetId;
}

export interface CustomPreset {
  id: string;
  name: string;
  bundle: CustomPresetBundle;
  createdAt: string;
}

const STORAGE_KEY = "luxsticker.customPresets.v1";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readAll(): CustomPreset[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("[custom-presets] failed to read from localStorage:", e);
    return [];
  }
}

function writeAll(presets: CustomPreset[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch (e) {
    console.warn("[custom-presets] failed to write to localStorage:", e);
  }
}

export function loadCustomPresets(): CustomPreset[] {
  return readAll();
}

export function saveCustomPreset(name: string, bundle: CustomPresetBundle): CustomPreset {
  const preset: CustomPreset = {
    id: `custom-preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || "My Style",
    bundle,
    createdAt: new Date().toISOString(),
  };
  const all = readAll();
  all.push(preset);
  writeAll(all);
  return preset;
}

export function deleteCustomPreset(id: string): void {
  writeAll(readAll().filter((p) => p.id !== id));
}
