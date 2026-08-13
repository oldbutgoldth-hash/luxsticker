# LUXSTICKER AI — Test Plan (updated Phase 1.2)

Manual test plan covering **Phase 1.2 — Final Quality Gate + Build
Versioning**. Run these in a real browser (`npm run dev`) — background
removal (WASM model) and Google Fonts both need real internet access, which
this sandbox's build environment does not have. Where noted, the underlying
*algorithm* was verified numerically instead of end-to-end in a browser (see
"Sandbox-verified" column).

Profile under test: `LINE_STICKER` — ≤370×320px, even dimensions, ≤1MB PNG,
transparent, ≥10px padding around content, no background leak.

| # | Case | Steps | Expected | Sandbox-verified |
|---|------|-------|----------|-------------------|
| 01 | Person + plain background | Upload a person photo with a simple/flat background | All 8 validation checks pass → ✓ READY TO USE | Pipeline/type-check only — the actual AI cutout needs a browser |
| 02 | Photo has a real background | Upload a photo with a busy background | Background removed by `@imgly/background-removal`; `background-removal` check passes | Needs a browser (WASM model fetch) |
| 03 | Background removal failure | Force `isFallbackCutout: true` | `background-removal` check fails → `validation.passed=false` → Download disabled → dedicated "⚠️ BACKGROUND REMOVAL FAILED" card with Try Again / Upload Another Image, **never** auto-fixed | **Yes** — confirmed by code path: `AUTO_FIXABLE_CHECK_IDS` in `export-normalizer` excludes `background-removal`; `ExportStatusCard` special-cases `isFallbackCutout` before the generic ready/not-ready branches |
| 04 | Content touching the edge | Compose so content sits close to the canvas edge | `cropAndFitToBounds` always re-centers content with a full `paddingPx` margin computed in *output* space (not scaled with content), so this self-corrects; the `padding` check's auto-fix (nudge `paddingPx` up, re-crop) is the backstop | **Yes** — see crop-math verification below |
| 05 | Dimension 371×321 (just over budget) | Content bbox that would naturally exceed 370×320 | `cropAndFitToBounds` computes one uniform scale factor so content+padding fits inside 370×320 — never stretches, aspect ratio preserved | **Yes** — numerically verified (see below): a 500×250 content box → scaled to 344×172 inside a 370×198 canvas, aspect ratio 2.0000 → 2.0000 exactly unchanged |
| 06 | Odd final dimension | Any content whose padded size rounds to an odd width/height | `toEvenClamp` rounds to the nearest even number (rounding down instead of up if that would exceed the profile max); `even-dimensions` is now its **own** validation check, separate from `dimensions` | **Yes** — all 5 geometry test cases below land on even width/height, e.g. 300×300 content → final 320×320 |
| 07 | File > 1 MB | Force a large/noisy composited canvas | `normalizeForProfile`'s auto-fix loop shrinks the canvas (×0.88 per attempt, up to 4 attempts) until `file-size` passes, or reports NOT READY with the reason listed if it can't | Retry-loop logic verified by type-check + code review; exact KB numbers need a browser |
| 08 | Long text | Enter a long custom sentence | Composition engine's shrink-until-clear loop prevents clipping; `content-clipping` check still passes | Unchanged from Phase 1.1, re-verified by type-check |
| 09 | Many decorations | Generate with a style that adds several decorations | Decoration engine's bounding-box collision avoidance prevents overlap with text/character; nothing pushed outside the working canvas | Unchanged decoration-engine logic, re-verified by type-check |
| 10 | Transparent background (baseline) | Any successful generation | `detectBackgroundLeak` finds no opaque pixel at any of the 4 corners, along any of the 4 edges, or anywhere outside the content bounding box | **Yes** — see leak-detection verification below |

## New in Phase 1.2: `getStickerContentBounds` + `detectBackgroundLeak`

**Single source of truth (spec §11).** `lib/content-bounds.ts` exports
`getStickerContentBounds(canvas)`, a thin wrapper around the shared
alpha-threshold constant (`CONTENT_ALPHA_THRESHOLD = 8`). `crop-engine`
(both `autoCropCanvas` and `cropAndFitToBounds`), `composition-engine`, and
`validation-engine`'s padding/leak checks all call this one function now,
instead of each calling `alphaBoundingBox` with their own threshold.

**Rigorous transparency check (spec §8/§9).** Re-implemented
`detectBackgroundLeak`'s exact algorithm as a standalone Node script
(`/tmp/verify-leak-detect.mjs` in this session) against a synthetic pixel
buffer, with no real Canvas needed:

```
PASS Clean: fully transparent padding -> hasLeak=false
PASS Leak at top-left corner -> hasLeak=true
PASS Leak on right edge (not a corner) -> hasLeak=true
PASS Leak just outside content box, away from any edge/corner -> hasLeak=true
```

The 4th case is the important one — a naive "check the 4 corners and edges
only" implementation would have missed it, since the leaked pixel touches
neither a corner nor an edge. The full outside-content-box scan catches it.

## Crop/scale geometry verification (carried over from Phase 1.1, re-checked)

Re-implemented `cropAndFitToBounds` + `toEvenClamp`'s exact math as a
standalone Node script (`/tmp/verify-crop-math.mjs`) against 5 scenarios —
all preserve aspect ratio exactly, land within 370×320, produce even
dimensions, and keep ≥10px padding:

```
PASS 1:1 square 300x300            -> final 320x320, aspect 1.0000 -> 1.0000
PASS Wide 500x250 (spec example)   -> final 370x198, aspect 2.0000 -> 2.0000
PASS Small content 120x80          -> final 146x106, aspect 1.5000 -> 1.5000
PASS Huge 2000x2000                -> final 320x320, aspect 1.0000 -> 1.0000
PASS Tall 200x600                  -> final 124x320, aspect 0.3333 -> 0.3333
```

## What was verified in this sandbox

1. `npm run lint` (ESLint) — clean.
2. `npm run build` (Next.js production build, Turbopack) — clean.
3. `tsc --noEmit` — clean.
4. Crop/fit geometry and leak-detection algorithms re-implemented and run
   standalone in Node (above) — all pass.
5. Manual code-path trace: background-removal failures and pre-crop content
   clipping are excluded from the auto-fix retry loop; a real background
   leak is never silently "fixed" either — it's a data-quality problem, not
   a geometry one, so it always surfaces as NOT READY.

## What still needs a real browser

- Actual AI background removal quality (`@imgly/background-removal` fetches
  its ONNX model from a CDN at runtime — blocked by this sandbox's network
  allowlist, works normally for end users).
- Visual confirmation of the editor's drag/resize/rotate/zoom interactions
  (unchanged this phase).
- Real PNG byte sizes for the file-size auto-fix loop (test case 07).
- End-to-end confirmation that `detectBackgroundLeak` correctly flags a
  *real* imperfect AI cutout (haze/halo around hair, etc.), as opposed to
  the synthetic pixel buffer used above.

---

# Phase 2 — Sticker Pack Generator

Manual test plan covering **Phase 2 — Sticker Pack Generator** (8/16/24/32/40
stickers from one photo). Route under test: `/pack`. Same sandbox constraint
as above — real AI background removal and IndexedDB persistence both need an
actual browser, so the algorithmic core of each feature was re-implemented
and verified standalone in Node where noted.

Spec reference: §39 requires at least 14 test cases. All 14 below.

| # | Case | Steps | Expected | Sandbox-verified |
|---|------|-------|----------|-------------------|
| 01 | Create 8-sticker pack | Upload photo → pick size 8 → pick a preset → Generate | `buildStickerPlan` returns exactly 8 `StickerPlanItem`s; `generatePackStickers` produces exactly 8 `PackStickerItem`s, each with a unique `sticker_NN.png` filename | **Yes** — `packStickerFilename` is a pure function (`sticker_${order.padStart(2,"0")}.png`), verified by type-check + code review; sequencing verified by `generatePackStickers`'s loop invariant (`order = index + 1`) |
| 02 | Create 16-sticker pack | Same, size 16 (default) | 16 plan items / 16 sticker items, filenames `sticker_01.png`...`sticker_16.png` | Same as above |
| 03 | Create 24-sticker pack | Same, size 24 | 24 items; pool (9 preset phrases + general emotion pool) repeats, so some emotions occur 2-3×; composition presets still vary per occurrence (not identical) | **Yes** — see "Composition variety" verification below |
| 04 | Create 32-sticker pack | Same, size 32 | 32 items; heavier repetition of the small preset pool, composition cycling still holds | **Yes** — same verification, size=32 case |
| 05 | Create 40-sticker pack | Same, size 40 | 40 items; max repetition; composition cycling still holds even at this density | **Yes** — same verification, size=40 case |
| 06 | Edit sticker 03 | Open dashboard → click sticker #3 → change text in the reused Sticker Editor → close | `PackStickerEditorModal` calls `saveEditedPackSticker`, which calls `refreshAfterEdit` (no AI, no re-composition, no background removal) — only that one `PackStickerItem` updates; `updateSticker` splices it back into `pack.stickers` by id | **Yes** — confirmed by code path: `handleEditorProjectChange` only touches the item whose id matches; `refreshAfterEdit` is the same unmodified Phase 1 function used by the single-sticker editor |
| 07 | Regenerate sticker 05 | Click "Regenerate" on sticker #5 only | Only sticker 05's `PackStickerItem` goes through `renderPackSticker` again (full Character Master → Layers → Composition → Text → Outline → Decoration → Render → Crop → Normalize → Validate); every other sticker in the pack (including 01-04, 06+) is untouched — `attempts` increments by 1 | **Yes** — `regeneratePackSticker(master, planItem, packStyle, previous)` takes a single plan item and returns a single new `PackStickerItem`; nothing in its signature or body touches `pack.stickers` as a whole |
| 08 | Delete a sticker | Click "Delete" on any sticker | That `PackStickerItem` (and its underlying plan item) is removed from the pack; remaining stickers keep their own `order`/filename — pack size shrinks by one, dashboard summary recount reflects N-1 total | Verified by code review — `handleDelete` filters both `pack.plan` and `pack.stickers` by id, no renumbering forced onto the rest of the pack |
| 09 | Duplicate a sticker | Click "Duplicate" on any sticker | `duplicatePlanItem` clones the plan row (same text/emotion/composition/decoration density) with a new id and appended order; `renderPackSticker` runs immediately for the new item only — original sticker is unaffected, pack size grows by one | **Yes** — `duplicatePlanItem` is a pure clone-with-new-id function, verified by type-check; render call targets only the new plan item |
| 10 | One sticker fails validation | Force one sticker's composited canvas to leave insufficient padding (or simulate a background-removal-failure `CharacterMaster`) | That sticker's `status` becomes `"needs_fix"` (not `"ready"`); `toPackStickerItem` derives status purely from `outcome.validation.passed`; the *rest* of the pack's stickers remain `"ready"` — one failure does not fail the batch (spec §17) | **Yes** — `toPackStickerItem`'s status derivation and `generatePackStickers`'s per-item try/catch (isolating one item's error into that item's own `status: "error"`) both verified by code review; this reuses the exact same `validateSticker`/`normalizeForProfile` engines already verified in Phase 1.2 |
| 11 | Pack validation failure blocks export | With ≥1 sticker `needs_fix`/`error`, try Export | `validateStickerPack` computes `status: "PARTIAL_READY"` (not `"READY"`) whenever `readyCount < total`; `exportPackAsZip` throws before building any ZIP (`มีสติ๊กเกอร์ที่ยังไม่ผ่านการตรวจสอบ...`) — Export button/flow never proceeds | **Yes** — `exportPackAsZip`'s guard clause (`notReady.length > 0 → throw`) runs before any `JSZip` calls, verified by code review; `validateStickerPack`'s status derivation (`total===0→DRAFT`, `readyCount===total→READY`, `readyCount===0→ERROR`, else `PARTIAL_READY`) verified by type-check |
| 12 | Export a fully-ready pack | Get every sticker to `status:"ready"` → Export | ZIP downloads containing `sticker_01.png`...`sticker_NN.png` (one per sticker, sorted by `order`) plus `BUILD_INFO.txt`; every PNG blob comes from `finalCanvas.toBlob`, i.e. already through Normalize→Validate — never a raw working canvas | Structure verified by code review (`exportPackAsZip`'s `zip.file(...)` loop + manifest call); actual byte-level PNG/ZIP generation needs a browser `<canvas>` |
| 13 | ZIP filename uniqueness | Call `packExportFilename(pack)` twice in immediate succession (same second) | Two different filenames — timestamp now includes milliseconds (`...${stamp}${ms}.zip`) specifically to avoid same-second collisions, on top of already varying by preset id and pack size | **Yes** — numerically verified below (1000-call collision test, 0 collisions) |
| 14 | ZIP does not overwrite a previous build | Export the same pack twice, a few seconds apart | Two distinct files land in the browser's downloads (distinct `stamp+ms` values); neither export call ever deletes, renames, or touches a previously-downloaded ZIP — `exportPackAsZip` only ever creates a new Blob + triggers a new `<a download>`, no filesystem access to prior exports at all | Same as #13 — verified by construction: the function has no code path that references or opens an existing file |

## Composition variety verification (spec §10/§11)

Re-implemented `buildStickerPlan`'s per-emotion occurrence-counter cycling
logic as a standalone Node script (`/tmp/verify-plan-variety.mjs`), using a
deliberately small 3-emotion pool so sizes 24/32/40 force heavy repetition —
the scenario most likely to expose duplicate consecutive compositions:

```
PASS size=8: 0 consecutive-same-emotion duplicate compositions, 7 distinct composition presets used across the pack
PASS size=16: 0 consecutive-same-emotion duplicate compositions, 8 distinct composition presets used across the pack
PASS size=24: 0 consecutive-same-emotion duplicate compositions, 8 distinct composition presets used across the pack
PASS size=32: 0 consecutive-same-emotion duplicate compositions, 8 distinct composition presets used across the pack
PASS size=40: 0 consecutive-same-emotion duplicate compositions, 8 distinct composition presets used across the pack
```

Every pack size, even at 40 stickers drawn from only 3 emotions, never
repeats the same composition preset on back-to-back occurrences of the same
emotion — confirming the `Map<EmotionId, number>` occurrence counter in
`lib/plan-builder.ts` does what §11 requires ("ห้ามใช้ Layout เดียวกันซ้ำทุกภาพ").

## ZIP filename uniqueness verification (spec §25/TEST 13/TEST 14)

First attempt: added only a millisecond suffix (`YYYYMMDD-HHMMSSmmm`) and
re-implemented `packExportFilename` standalone in Node, calling it 1000 times
in a tight synchronous loop:

```
FAIL 998 collisions
```

Milliseconds alone are **not** sufficient — a synchronous loop (or a real
double-click) can produce many calls inside the same millisecond, since
`Date` resolution isn't fine enough to separate them. This would have been a
real bug in production if a user double-clicked Export quickly. Fixed by
adding a monotonic, non-wrapping per-session call counter appended after the
millisecond field (`lib/pack-export.ts`, `exportCallCounter`) — re-verified:

```
PASS 1000 rapid calls -> 1000 unique filenames, 0 collisions
Same-millisecond stress (1500 calls, clock frozen): 0 collisions, 1500 unique
```

The second line freezes the clock entirely (simulating an impossible
worst case — 1500 exports in the exact same millisecond) to confirm the
counter alone, with no wraparound, guarantees uniqueness independent of the
timestamp. This is what actually satisfies TEST 13/14, not the timestamp.

## What was verified in this sandbox (Phase 2)

1. `npm run lint` (ESLint) — clean.
2. `npm run build` (Next.js production build, Turbopack) — clean, both `/`
   and `/pack` routes registered as static.
3. `tsc --noEmit` — clean.
4. Composition-variety and ZIP-filename-uniqueness algorithms re-implemented
   and run standalone in Node (above) — all pass.
5. Manual code-path trace for every failure-isolation guarantee in the spec:
   one sticker's render/validation failure never throws out of
   `generatePackStickers`'s loop (caught per-item); `exportPackAsZip` never
   builds a ZIP while any sticker is not `"ready"`; `regeneratePackSticker`
   and `saveEditedPackSticker` both operate on exactly one `PackStickerItem`
   and never touch the rest of `pack.stickers`.
6. Background removal called exactly once per pack: only
   `handleFileSelected` (pack upload step) calls
   `removeBackgroundAndBuildLayer`; every subsequent render
   (`renderPackSticker`, `regeneratePackSticker`) builds its `CharacterLayer`
   via `characterLayerFromMaster`, which only reads the already-produced
   `master.cutoutUrl` — verified by `grep` showing
   `removeBackgroundAndBuildLayer` has exactly one call site in the Phase 2
   code.

## What still needs a real browser (Phase 2)

- Actual pack-level AI background removal quality and timing (same
  CDN/network constraint as Phase 1).
- IndexedDB persistence round-trip (`pack-storage.ts`) — save → refresh →
  restore, including the blob-URL-rehydration path for `finalCanvas` and
  `CharacterMaster` images.
- Real click-through of the 8-step UI flow (Upload → Size → Preset → Plan →
  Generate → Review → Edit/Regenerate → Export) in `PackGeneratorApp.tsx`.
- Real ZIP byte contents (PNG validity, `BUILD_INFO.txt` contents) opened
  from an actual downloaded file — the export code path was verified
  structurally, not by opening a produced ZIP in this sandbox.
- Visual grid responsiveness (4-5 cols desktop / 3 tablet / 2 mobile) across
  real viewport sizes.
