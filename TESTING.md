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

---

# Phase 2.5 — AI Expression & Pose Engine

Manual test plan covering **Phase 2.5 — AI Expression & Pose Engine**: from
one photo, generate stickers with varying expression/pose via a pluggable
`AIImageProvider`, defaulting to a zero-cost `MockExpressionProvider` in
development. Spec §33 requires 10 test cases — all 10 below, each noting
whether it was verified algorithmically in this sandbox (no DOM/Canvas/
network available here) or needs a real browser.

| # | Case | Steps | Expected | Sandbox-verified |
|---|------|-------|----------|-------------------|
| 01 | Mock Provider | Generate a sticker with "ใช้ AI Expression"/"ใช้ AI Expressions" on, `AI_PROVIDER=mock` | `MockExpressionProvider.generateExpression()` returns the same character reference cutout, stamped with a visible "MOCK — NO AI (emotion/pose)" badge; `metadata.mock === true`; UI never shows "AI Generated" for this result | Code review + type-check — `MockExpressionProvider` draws to an `HTMLCanvasElement`/`Image`, which needs a real browser to execute; its *contract* (never fabricates a new person, always reuses the reference cutout, always sets `mock: true`) was verified by reading `providers/ai/mock-expression-provider.ts` line by line against spec §6 |
| 02 | Expression Prompt Builder | Call `buildExpressionPrompt({emotion, pose, style})` | Prompt string contains every positive preservation directive (keep same person, preserve face/hairstyle/skin tone/body/clothing/accessories/identity) AND every negative directive (no identity/hairstyle/clothing change, no extra people, no accessory removal, no age/skin tone change, no different person, no background) AND the specific expression+pose description | **Yes** — re-implemented the exact string-building logic standalone in Node (`/tmp/verify-phase-2.5.mjs`), asserted all 9 negative directives and 5 sampled positive directives are present, plus the expression/pose text itself |
| 03 | Character Reference Input | Compute `characterHash` for two identical cutouts vs. one different cutout | Same pixel content → same hash (cache can hit); different pixel content → different hash (cache must miss, never silently reuse a stale expression for a different photo) | **Yes** — re-implemented `hashPixelData`'s exact FNV-1a loop standalone in Node against synthetic pixel buffers; identical buffers hash identically, a single-byte difference changes the hash |
| 04 | Provider Failure | Force the AI provider to throw (network error, timeout, 4xx/5xx) | `generateCharacterExpression` never throws out of the pipeline; returns `aiStatus: "AI_FAILED"`, `characterMode: "original_character"`, and `source` pointing at the unmodified Character Master cutout; that one sticker's `status` becomes `"needs_ai"` — the rest of the batch is unaffected | **Yes** — re-implemented the try/catch fallback control flow standalone in Node with a provider stub that always throws; confirmed the caller never re-throws and always falls back to the reference's own cutout |
| 05 | Retry Single Sticker | On a `"needs_ai"` sticker, click Retry | `regeneratePackStickerWithAI` re-runs `generateCharacterExpression` + render for ONLY that one `PackStickerItem` (same `id`, `attempts + 1`); every other sticker in `pack.stickers` is untouched | Verified by code review — `regeneratePackStickerWithAI`'s signature takes a single `planItem`/`previous` pair and returns a single new item; nothing in its body iterates `pack.stickers` |
| 06 | Cache Hit | Call the expression engine twice with identical `{characterHash, emotion, pose, style}` | Second call is served from `lib/expression-cache.ts`'s in-memory Map — the underlying `AIImageProvider.generateExpression()` is called exactly once for those inputs | **Yes** — re-implemented the cache-check-before-provider-call control flow standalone in Node with a call-counting fake provider: 2 distinct inputs + 1 repeat of the first → provider called exactly 2 times, not 3 |
| 07 | Cache Miss | Call the expression engine with a different `{emotion, pose}` than any prior call | Cache key differs (`buildExpressionCacheKey` — spec §29/§30 key shape `hash:emotion:pose:style`) → provider is called again, result cached under the new key | **Yes** — same script as #06; the third (different-emotion) call was confirmed `fromCache === false` |
| 08 | API Key Never Exposed | Run `npm run build`, grep the compiled client bundle (`.next/static`) for the literal string `AI_PROVIDER_API_KEY` | Never appears — `AI_PROVIDER_API_KEY` is read exclusively inside `app/api/generate-expression/route.ts` (a server-only Route Handler, never bundled to the client); the client only ever sees `NEXT_PUBLIC_AI_PROVIDER` (a provider *name*, not a secret) | **Yes, ran for real** — after a clean `npm run build`: `grep -rl AI_PROVIDER_API_KEY .next/static/` → 0 matches (client bundle, clean); `grep -rl AI_PROVIDER_API_KEY .next/server/` → 4 matches (server-only chunks, correct — that's where the route handler itself lives, never shipped to a browser). Also live-tested the route: `AI_PROVIDER=mock` → 200 with the expected `{image, metadata}` JSON shape; `AI_PROVIDER=provider-a` with no `AI_PROVIDER_API_KEY` set → 501 with a generic Thai error message, key value never present in the response body |
| 09 | 16-sticker AI Plan | `buildStickerPlan(16, presetId)` | All 16 `StickerPlanItem`s carry a valid `{expression, pose}` pair (derived from `EMOTION_EXPRESSION_MAP[item.emotion]`), independent of `compositionPresetId`/`decorationDensity` cycling already verified in Phase 2 | **Yes** — re-implemented the plan-builder's expression/pose assignment standalone in Node; all 16 items have both fields set to valid strings |
| 10 | 40-sticker AI Plan | `buildStickerPlan(40, presetId)` | Same guarantee at the largest pack size — every item still gets a valid `{expression, pose}` pair even with heavy pool repetition | **Yes** — same script, size=40 case, all 40 items pass |

## Why the shared engine matters (spec §32)

`lib/expression-pipeline.ts`'s `generateCharacterExpression()` is called from
exactly two places: `lib/pack-pipeline.ts` (`renderPackStickerWithAI`, used
by both batch generation and single-sticker-in-a-pack regenerate) and
`components/sticker-generator/StickerGeneratorApp.tsx` (the standalone
single-sticker flow, via `characterReferenceFromLayer` +
`generateCharacterExpression` directly). Verified by `grep` — there is only
one `generateCharacterExpression` function definition in the whole codebase,
and both call sites import it from the same module. Prompt construction
(`buildExpressionPrompt`), caching (`expression-cache.ts`), and the provider
registry (`providers/ai/registry.ts`) are each single-instance too, for the
same reason.

## What was verified in this sandbox (Phase 2.5)

1. `npm run lint` (ESLint) — see Task 44 build report.
2. `npm run build` (Next.js production build, Turbopack) — see Task 44 build
   report. Confirms `app/api/generate-expression` compiles as a server Route
   Handler and is excluded from the client bundle.
3. `tsc --noEmit` — see Task 44 build report.
4. Prompt builder, character hashing, cache hit/miss control flow, provider
   failure fallback, and plan-level expression/pose assignment (TEST 02-04,
   06, 07, 09, 10) — all re-implemented standalone in Node and run above, 19
   assertions, all pass.
5. Manual code-path trace: `AUTO_FIXABLE_CHECK_IDS`-style exclusion pattern
   reused for AI — a failed AI call is never silently retried or hidden,
   always surfaces as `status: "needs_ai"` with the exact 3 actions spec §17
   requires (Retry / Use Original Character / Edit Manually), all wired to
   real handlers in `PackGeneratorApp.tsx` (`handleAiRetry`,
   `handleUseOriginalCharacter`, and the existing editor for "Edit Manually").
6. Confirmed via `grep` that `AI_PROVIDER_API_KEY` is referenced in exactly
   one file in the whole project: `app/api/generate-expression/route.ts`.

## What still needs a real browser (Phase 2.5)

- `MockExpressionProvider`'s actual canvas drawing (badge compositing) — its
  control-flow contract was verified, but rendering needs a real
  `HTMLCanvasElement`.
- End-to-end AI toggle click-through in both the pack flow and the
  single-sticker flow (checkbox → cost preview → generate → per-sticker AI
  status badges).
- A genuinely failing provider triggering the "needs_ai" card + banner in
  the actual dashboard grid UI (simulated in Node here, not clicked through).
- Real vendor integration — Phase 2.5 ships the full plumbing (interface,
  registry, prompt builder, cache, API route, env handling) but does not
  wire up a specific real image-generation vendor (spec §7 explicitly asks
  for the abstraction first, not a vendor pick); `AI_PROVIDER` set to
  anything other than `mock` currently returns a clear 501 from the API
  route rather than a real generation.
