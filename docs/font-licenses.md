# Font Licenses — LUXSTICKER AI

Every font shipped in this project (Phase 1 through Phase 3.1) is a Google
Font, loaded at runtime via the `<link>` in `app/layout.tsx`
(`GOOGLE_FONTS_HREF` in `lib/fonts.ts`) — never a locally-bundled font file.
All 7 are licensed under the **SIL Open Font License 1.1 (OFL)**, which
explicitly permits commercial use, redistribution, and embedding without
royalties or attribution requirements in the shipped product (attribution is
appreciated but not legally required by the OFL). No font in this project
requires a paid license, a per-seat license, or any usage tracking.

Per spec §33's requirement — "ห้ามนำ Font ที่มี License จำกัดมาใส่ในระบบโดยไม่ได้
ตรวจสอบ License" (never add a font with a restricted license without checking
first) — every font below was deliberately chosen FROM the Google Fonts
catalog specifically because the whole catalog is pre-vetted to be
commercial-safe; nothing here was sourced from a third-party foundry or a
"free for personal use only" font pack.

| Font | Used for | License | Source | Commercial Use |
|---|---|---|---|---|
| Kanit | Style presets: funny/cartoon/comic; Font category: comic (700), bold (900) | SIL Open Font License 1.1 | https://fonts.google.com/specimen/Kanit | Yes — no restriction |
| Mitr | Style presets: cute/kawaii; Font category: cute | SIL Open Font License 1.1 | https://fonts.google.com/specimen/Mitr | Yes — no restriction |
| Prompt | Style preset: real; Font category: minimal | SIL Open Font License 1.1 | https://fonts.google.com/specimen/Prompt | Yes — no restriction |
| Mali | Style preset: chibi; Font category: kawaii | SIL Open Font License 1.1 | https://fonts.google.com/specimen/Mali | Yes — no restriction |
| Charmonman | Style preset: hand_drawn; Font category: handwritten | SIL Open Font License 1.1 | https://fonts.google.com/specimen/Charmonman | Yes — no restriction |
| Chonburi | Font category: brush | SIL Open Font License 1.1 | https://fonts.google.com/specimen/Chonburi | Yes — no restriction |
| Taviraj | Font category: luxury | SIL Open Font License 1.1 | https://fonts.google.com/specimen/Taviraj | Yes — no restriction |

## A note on "brush" specifically

Spec §10 asks for a "พู่กัน" (brush/calligraphy-stroke) category. There is no
Thai-supporting Google Font that is a genuine calligraphic brush-stroke
typeface at the time this was built. **Chonburi** — a bold, thick-stroked
Thai display font — was picked as the closest commercial-safe approximation
available in the Google Fonts catalog, and this is noted honestly in
`config/font-catalog.ts`'s `description` field rather than presented as a
literal brush font. If a genuine Thai brush/calligraphy webfont with a
compatible commercial license becomes available later, swapping it in is a
one-entry change in `config/font-catalog.ts` plus a `<link>` update in
`lib/fonts.ts` — nothing else in the app needs to change (spec §11).

## Adding a new font later

1. Confirm its license on the Google Fonts page (or, if not a Google Font,
   read the actual license file — do not assume "free download" means
   "commercial use permitted").
2. Add a row to the table above.
3. Add the family + weights to `GOOGLE_FONTS_HREF` in `lib/fonts.ts`.
4. Add a matching CSS variable in `app/globals.css`.
5. Add/update an entry in `config/font-catalog.ts`.

No other file needs to change — every draw call resolves a font through
`resolveCssFontVar()` (`lib/fonts.ts`), never a hardcoded family name.
