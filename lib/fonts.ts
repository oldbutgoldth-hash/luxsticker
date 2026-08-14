// Thai-supporting Google Fonts (spec §7: "ต้องรองรับภาษาไทยเป็นหลัก").
//
// Loaded via a plain <link> tag in app/layout.tsx (see GOOGLE_FONTS_HREF)
// rather than next/font/google, deliberately: next/font fetches font files
// at *build* time, which breaks `next build` on any machine/CI runner that
// restricts outbound access to fonts.gstatic.com (this sandbox included).
// A <link> defers the fetch to the end user's own browser at runtime, which
// has normal internet access, and keeps the production build 100% offline.
//
// The resulting family names are declared as CSS variables in globals.css
// (--font-kanit / --font-mitr / --font-prompt) so the rest of the app never
// hardcodes a literal font name.
// Phase 3.1 §10/§33/§34 — 4 new families added for the Typography category
// system (config/font-catalog.ts): Mali (kawaii/rounded), Charmonman
// (handwritten/hand-drawn), Chonburi (bold display, used for "brush"), and
// Taviraj (elegant serif, used for "luxury"). All 7 families total are
// Google Fonts under the SIL Open Font License 1.1 — see
// /docs/font-licenses.md for the full per-font license record (spec §33).
//
// Still one single <link>, still weight-scoped per family (spec §34 "อย่า
// โหลด Font ทุกตัวพร้อมกันถ้าไม่จำเป็น ใช้ Font Loading แบบ Lazy"): a `<link>`
// only *declares* @font-face rules — the browser itself only fetches the
// actual font FILE the first time that family/weight is actually used to
// render text on the page, which is the natural "lazy" behavior spec §34
// asks for. No extra lazy-loading code is needed on top of this — adding
// more @font-face declarations here does not cost anything until a sticker
// actually uses that family.
export const GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Kanit:wght@400;600;700;800;900&family=Mitr:wght@400;500;600;700&family=Prompt:wght@400;500;600;700&family=Mali:wght@400;600;700&family=Charmonman:wght@400;700&family=Chonburi&family=Taviraj:wght@400;500;600&display=swap";

export const FONT_CHOICES = [
  { id: "var(--font-kanit)", label: "Kanit (คม / ตัวหนา)" },
  { id: "var(--font-mitr)", label: "Mitr (มน / น่ารัก)" },
  { id: "var(--font-prompt)", label: "Prompt (สะอาด / อ่านง่าย)" },
  { id: "var(--font-mali)", label: "Mali (คาวาอี้ / มน)" },
  { id: "var(--font-charmonman)", label: "Charmonman (ลายมือ)" },
  { id: "var(--font-chonburi)", label: "Chonburi (ตัวหนาสไตล์แปรง)" },
  { id: "var(--font-taviraj)", label: "Taviraj (หรู / เซอริฟ)" },
];

/**
 * Canvas 2D's `font` property needs a literal font-family name, not a CSS
 * `var(--font-x)` reference. next/font/google exposes the real generated
 * family name through that CSS variable on <html>, so we resolve it once at
 * draw time. Falls back to a safe Thai-capable system stack if unresolved
 * (e.g. during SSR, or before the variable is attached to the DOM).
 */
export function resolveCssFontVar(varExpr: string): string {
  const match = /var\((--[\w-]+)\)/.exec(varExpr);
  if (!match || typeof window === "undefined") return varExpr;
  const resolved = getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim();
  return resolved || '"Noto Sans Thai", sans-serif';
}
