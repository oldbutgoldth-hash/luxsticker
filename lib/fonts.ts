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
export const GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Kanit:wght@400;600;700;800&family=Mitr:wght@400;500;600;700&family=Prompt:wght@400;500;600;700&display=swap";

export const FONT_CHOICES = [
  { id: "var(--font-kanit)", label: "Kanit (คม / ตัวหนา)" },
  { id: "var(--font-mitr)", label: "Mitr (มน / น่ารัก)" },
  { id: "var(--font-prompt)", label: "Prompt (สะอาด / อ่านง่าย)" },
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
