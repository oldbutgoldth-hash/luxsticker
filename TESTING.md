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

---

# Phase 3 — Real AI Expression & Character Generation

Manual test plan covering **Phase 3 — Real AI Expression & Character
Generation**: a real, server-only OpenAI `gpt-image-1` adapter behind the
`AIImageProvider` interface, an `AI_MODE=mock|real` master safety switch, an
image quality gate before any AI output can enter the sticker pipeline,
bounded-concurrency batch generation, and cache-key/badge-wording updates.
Spec §38 requires 18 test cases — all 18 below, each noting whether it was
verified algorithmically in this sandbox or needs a real browser/live
network.

**Read this before the table:** per the project's explicit instruction, this
sandbox's outbound network is restricted to `registry.npmjs.org` — direct
`curl` tests to OpenAI, Google, Replicate, Stability, and fal.ai all failed
at the connection level (`HTTP_STATUS:000`). This was confirmed and reported
before the adapter was written (Task 47). Every test below that is about
*logic* (request shape, error classification, cache keys, quality gates,
concurrency limits, badge wording) was re-implemented standalone in Node and
is marked **Yes**. The one test that requires an actual live call to OpenAI's
API is marked **NOT EXECUTABLE** — this is a real, honestly-reported gap, not
a passed test.

| # | Case | Steps | Expected | Sandbox-verified |
|---|------|-------|----------|-------------------|
| 01 | AI_MODE default safety | Read `AI_MODE` with the var unset, empty, or set to a typo'd value | Resolves to `"mock"` in every case — only the exact string `"real"` (case-insensitive) enables the real vendor path | **Yes** — `/tmp/verify-phase-3.mjs` TEST 01, 4 assertions |
| 02 | Real mode, provider not configured | Set `AI_MODE=real` with `AI_PROVIDER`/`AI_PROVIDER_API_KEY` unset | API route returns HTTP 503 with the exact message `"AI Provider ยังไม่ได้ตั้งค่า"` — never silently falls back to mock (spec §33) | **Yes** — TEST 02, 5 assertions |
| 03 | Client disables AI toggle when unavailable | `GET /api/generate-expression` returns `{mode:"real", configured:false}` | "Use AI Expressions" checkbox is `disabled`, shows the "⚠ AI Provider ยังไม่ได้ตั้งค่า" warning; a `mode:"mock"` or `configured:true` status leaves it enabled | **Yes** — TEST 03, 4 assertions. Real click-through of the disabled checkbox styling needs a browser |
| 04 | Client resolves blob: to data: before POST | `RemoteExpressionProvider.generateExpression()` called with a `characterReference.cutoutUrl` that's a `blob:` URL | `toDataUrl()` fetches and converts it to a self-contained `data:image/...;base64,...` string before the POST body is built — the server process could never resolve a browser `blob:` URL itself | **Yes** — TEST 04 (decision logic); the actual `fetch()`/`FileReader` conversion needs a real browser to execute |
| 05 | OpenAI request shape | Call `generateWithOpenAiImages()` | Multipart form always includes `model`, `prompt`, `size`, `background: "transparent"`, `n: "1"`, and the reference image as a `Blob` | **Yes** — TEST 05, 4 assertions |
| 06 | OpenAI error classification | Simulate HTTP 401/403/429/500 and a network abort | 401/403 → `invalid_key` → 503; 429 → `rate_limited` → 429; timeout/abort → `timeout` → 504; other → `provider_error` → 502 — every kind maps to a distinct, correct status | **Yes** — TEST 06, 9 assertions |
| 07 | Sanitized error responses | Trigger a provider error with `NODE_ENV=production` vs. development | Production response never includes `detail` (raw HTTP body/stack); both modes show the same generic Thai message; no internals ever leak into the response body | **Yes** — TEST 07, 4 assertions |
| 08 | Mock never mislabeled as real | Generate via `MockExpressionProvider` | Result always carries `metadata.mock: true`; UI badge logic can never render "✓ AI GENERATED" for a mock result — only "MOCK — NO AI" (spec §34: no fake AI badged as real) | **Yes** — TEST 08, 2 assertions |
| 09 | Prompt forbids AI-rendered text | Call `buildExpressionPrompt()` | Negative directive list always includes `"Do not render any text, letters, or words in the image."` (spec §13/§14 — text comes from the app's own Canvas Text Engine, never the AI) | **Yes** — TEST 09, re-verifies the exact same string list live-read from `lib/expression-prompt-builder.ts` in this session, 2 assertions |
| 10 | PROMPT_VERSION in cache key | Build a cache key before and after bumping `PROMPT_VERSION` | Keys differ — a prompt-wording change can never silently serve a stale image generated under the old prompt structure | **Yes** — TEST 10, 1 assertion |
| 11 | Quality gate: resolution | Feed a 1024×1024 image and an 8×8 image through `validateAiImage` | Normal size passes; sub-32px image is rejected as "ภาพที่ได้จาก AI มีขนาดเล็กเกินไปหรือไม่ถูกต้อง" | **Yes** — TEST 11, 3 assertions |
| 12 | Quality gate: corrupt image | Feed an undecodable image URL through `validateAiImage` | `loadImage()`'s throw is caught and reported as a quality failure ("ภาพที่ได้จาก AI เสียหาย"), never an unhandled exception that crashes the pipeline | **Yes** — TEST 12, 2 assertions |
| 13 | Quality gate: no subject | Feed an all-transparent (or near-empty) image through `validateAiImage` | Alpha-bounding-box area below 2% of the 128×128 sample is rejected as "ไม่มีตัวละคร" — a technically-valid-but-empty AI response is never accepted as a usable sticker character | **Yes** — TEST 13, 3 assertions |
| 14 | Any AI failure → safe fallback | Force a provider throw (network/timeout/quality-gate failure) | `generateCharacterExpression()` never throws out of the pipeline; always returns `aiStatus: "AI_FAILED"`, `characterMode: "original_character"`, `source` pointing at the unmodified Character Master cutout | **Yes** — TEST 14, 2 assertions (also re-verified in Phase 2.5's TEST 04, still holds with the new quality-gate failure mode added) |
| 15 | AI image never bypasses the pipeline | Trace `generateCharacterExpression()`'s return value through to export | It returns a `CharacterSource`, consumed only by `characterLayerFromMaster()` — the exact same function the non-AI path uses — which always flows into the same render → Validation Engine → export chain. No code path anywhere calls `provider.generateExpression()`'s result directly into an export/download function | Code-path trace via `grep`/read — confirmed no second consumer of `ExpressionGenerationImage`/`generateCharacterExpression`'s output exists outside `expression-pipeline.ts`'s own return value |
| 16 | Badge wording (spec §21 exact strings) | Render a sticker in each state: `needs_ai`, resolved `original_character`, `AI_READY`/`ai_expression`, no `aiStatus` at all | Shows exactly "⚠ AI FAILED" / "✓ ORIGINAL CHARACTER" / "✓ AI GENERATED" / no badge, respectively, in that precedence order | **Yes** — TEST 16, 4 assertions, matches `aiBadgeFor()` in `PackDashboardGrid.tsx` line-for-line |
| 17 | Regenerate Fresh cache bypass | Call the expression engine twice for the same key: once normally, once with `forceFresh: true` | Normal call hits the stale cached entry; the `forceFresh` call ignores it, gets a fresh result, and writes it back so later normal calls benefit again | **Yes** — TEST 17, 3 assertions |
| 18 | Bounded concurrency + per-item isolation | Run a 12-item batch through `runWithConcurrencyLimit(items, 3, worker)` where item #5's worker throws | Max in-flight workers never exceeds 3; item #5 reports its own failure; the other 11 complete successfully and independently — concurrency never turns one failure into a batch-wide failure | **Yes** — TEST 18, 4 assertions (12-item run, includes a stress variant with 25 items and randomized delays in `/tmp/concurrency-test/verify.mjs`, 32 further assertions) |
| — | **Real Provider Adapter — live OpenAI call** | POST a real character reference to `https://api.openai.com/v1/images/edits` with a real `AI_PROVIDER_API_KEY` | A real edited PNG comes back, `hasTransparency: true`, decodable, passes the quality gate | **NOT EXECUTABLE IN THIS SANDBOX** — outbound network is restricted to `registry.npmjs.org`; every candidate vendor (OpenAI, Google, Replicate, Stability, fal.ai) failed at the connection level when tested directly (Task 47). The adapter's request/response *shape* was verified against OpenAI's documented API (tests 05-06 above); whether the real endpoint actually accepts and responds exactly as coded has not been observed. |

## Character consistency — honestly not measurable here

Spec §39 requires testing 5-10 real examples and reporting Face/Hair/
Clothing/Identity consistency observations, and explicitly forbids claiming
"100% consistency." Because no live call to the real provider could be made
in this environment (see above), **no real generated image has been produced
or observed in this session, so there is nothing here to report** — not
"100% consistency," not "mostly consistent," nothing. This is the literal
outcome of the constraint the project's own instructions asked to be
reported plainly rather than worked around with mock output relabeled as
real.

## API key exposure — re-verified after the Phase 3 build

Same method as Phase 2.5's TEST 08, re-run after adding the new
`providers/ai/server/openai-image-adapter.ts` file:

- `grep -rl AI_PROVIDER_API_KEY .next/static/` → **1 match**, but it is the
  literal variable *name* inside a UI help string ("...ผู้ดูแลระบบต้องตั้งค่า
  AI_PROVIDER และ AI_PROVIDER_API_KEY ก่อนใช้งาน AI Expressions..." in
  `PackGeneratorApp.tsx`, telling an admin which env vars to set) — not the
  secret *value*. Confirmed by reading the matched chunk directly: no key
  value, only the variable name as help text.
- `grep -rl AI_PROVIDER_API_KEY .next/server/` → 6 matches, all in
  server-only chunks (the route handler and its imports), never shipped to a
  browser.
- `grep -rn openai-image-adapter` across the whole project (excluding
  `node_modules`/`.next`) → exactly one import, from
  `app/api/generate-expression/route.ts`. No `"use client"` file imports it.

## What was verified in this sandbox (Phase 3)

1. `npm run lint`, `tsc --noEmit`, `npm run build` — see Task 58 build
   report.
2. Tests 01-14, 16-18 above — 59 assertions, all pass
   (`/tmp/verify-phase-3.mjs`), plus the separate 32-assertion concurrency
   stress test.
3. API key exposure re-check (above) — confirmed clean, with the one
   variable-name-in-help-text occurrence explicitly distinguished from an
   actual secret leak.
4. `npm run build`'s route table confirms `/api/generate-expression` compiles
   as a dynamic (`ƒ`) server route, not a static/client-bundled page.

## What still needs a real browser + real network (Phase 3)

- Test 04's actual `fetch()`/`FileReader` blob-to-data-URL conversion.
- Test 15's pipeline trace as an actual click-through (upload → AI toggle →
  generate → exported PNG), not just a code-path read.
- The live OpenAI test row above, and everything spec §39/§40 asks for
  (5-10 real examples, Face/Hair/Clothing/Identity consistency observations,
  an 8-sticker real test pack) — none of this is executable from this
  sandbox, and nothing here claims otherwise.

---

# Phase 3.1 — Cartoon Sticker + Style System + Trendy Typography

Manual test plan covering **Phase 3.1**: 6 Character Art Styles (Real Photo/
Cartoon/Kawaii/Chibi/Comic/Hand Drawn), a Typography category system (8
font categories + Emotion matching), a Decoration category system (8
categories + style-flavored glyph bias), a Color Theme system, Style/Font
Lock, Auto/Manual Design, an expanded Preset system with custom "Save My
Style", and outline thickness that scales relative to character size. Spec
§40 requires 20 test cases — all 20 below.

Same honesty constraint as Phase 3: this sandbox's outbound network is still
restricted to `registry.npmjs.org` (re-confirmed, unchanged since Task 47 in
the previous phase). Every test here about *logic* — prompt construction,
resolver precedence, Thai text-cluster safety, outline scaling — is
independently re-implemented in Node and marked **Yes**. No test claims a
live AI Cartoon Transformation call was actually observed.

| # | Case | Steps | Expected | Sandbox-verified |
|---|------|-------|----------|-------------------|
| 01 | Real Photo Style | Generate with `style: "real"` | `isRealPhotoStyle("real") === true`; the AI prompt never includes an art-transformation directive — Mode A stays pure background-removal (+ optional AI expression/pose only) | **Yes** — `/tmp/verify-phase-3.1.mjs` TEST 01 |
| 02 | Cartoon Style | Generate with `style: "cartoon"`, AI on | Prompt includes `STYLE_PRESETS.cartoon.promptDirective` ("clean modern cartoon illustration...") plus the extra identity-reinforcement sentence for art-transform styles | **Yes** — TEST 02-06 |
| 03 | Kawaii Style | Same, `style: "kawaii"` | Prompt includes the kawaii promptDirective + identity reinforcement | **Yes** — TEST 02-06 |
| 04 | Chibi Style | Same, `style: "chibi"` | Prompt includes the chibi promptDirective + identity reinforcement | **Yes** — TEST 02-06 |
| 05 | Comic Style | Same, `style: "comic"` | Prompt includes the comic promptDirective + identity reinforcement | **Yes** — TEST 02-06 |
| 06 | Hand Drawn Style | Same, `style: "hand_drawn"` | Prompt includes the hand-drawn promptDirective + identity reinforcement | **Yes** — TEST 02-06 |
| 07 | Font Category | Read `FONT_CATALOG`/`FONT_STYLE_ORDER` | Exactly 8 categories (kawaii/cute/comic/handwritten/bold/brush/minimal/luxury), each resolving through a `var(--font-*)` CSS variable (never a hardcoded family name); `resolveFontStyle(..., "auto")` never returns `"auto"` itself | **Yes** — TEST 07 |
| 08 | Thai Text | Curved-text layout on a word with a tone mark + vowel sign (e.g. "กิ่ง") | Combining marks (สระ/วรรณยุกต์) stay glued to their base consonant as one glyph cluster along the arc — never rendered as a separately-positioned floating mark | **Yes** — TEST 08. **This caught a real bug during this session**: the initial curved-text implementation split by raw `Array.from(line)` (one Canvas draw call per UTF-16 codepoint), which would have visually detached Thai tone marks/vowel signs from their base character on any curved sticker. Fixed by adding `splitGraphemeClusters()` (Unicode `\p{Mn}` combining-mark detection) in `engines/text-engine/index.ts` before this session's TESTING.md was written — not glossed over |
| 09 | Long Thai Text | Curved layout with a long Thai sentence | The bow angle is clamped (`Math.PI * 0.7` max) regardless of text length — never wraps the text past ~126° of a circle into an unreadable loop | **Yes** — TEST 09 |
| 10 | Font + Emotion Matching | `resolveFontStyle(emotion, "auto")` for the 7 emotions spec §12 gives explicit examples for | Exact match: สวัสดี→kawaii, ขอบคุณ→handwritten, 555→comic, สู้ๆ→bold, โกรธแล้วนะ→brush, รักนะ→handwritten, ฝันดี→cute | **Yes** — TEST 10 |
| 11 | Decoration Matching | `resolveDecorationCategory`/`resolveDecorationGlyphs` for various emotion+style combos | Emotion resolves to the right category (cry→sad, hungry→hungry); an explicit pack category always overrides the emotion-derived guess; a Style's signature glyphs (e.g. kawaii's ✨💕⭐) get promoted to the front of whichever category pool is in use | **Yes** — TEST 11 |
| 12 | Style Lock | Inspect a freshly-created pack (`newPack()`) | `styleLocked: true` by default (spec §22) | **Yes** — TEST 12/13 |
| 13 | Font Lock | Same | `fontLocked: true` by default (spec §23) | **Yes** — TEST 12/13 |
| 14 | Auto Design | New pack's `designMode` + resolve every "auto" field | `designMode: "auto"` by default; `resolveFontStyle`/`resolveDecorationCategory` with `"auto"` pack values always return a concrete, non-"auto" result — never left unresolved at render time | **Yes** — TEST 14 |
| 15 | Manual Design | Call the same resolvers with an explicit per-item override set | The item-level override (`fontStyleOverride`/`decorationCategoryOverride`) always wins over both the pack value and "auto" | **Yes** — TEST 15 |
| 16 | Custom Preset | `saveCustomPreset()` → `loadCustomPresets()` → `deleteCustomPreset()` | Round-trips exactly (bundle fields preserved); deleted preset no longer appears in the list | **Yes** — TEST 16 (localStorage simulated with an in-memory Map, since this sandbox has no `window`; `lib/custom-presets.ts` itself guards every call with `typeof window === "undefined"`) |
| 17 | Cartoon AI Failure | Force the provider to throw while `style` is `cartoon`/`chibi`/`comic` | `generateCharacterExpression`'s catch path (Phase 3, re-verified here per-style) always returns `aiStatus: "AI_FAILED"`, `characterMode: "original_character"` — the style being transformed doesn't change the failure contract | **Yes** — TEST 17 |
| 18 | Fallback | Render the AI failure banner's fallback button for a `cartoon`-style sticker vs. a `real`-style sticker | Non-"real" style shows "📷 Use Real Photo"; "real" style shows the more generic "Use Original Character" — neither is ever labeled as a successful AI result (spec §38/§39) | **Yes** — TEST 18 |
| 19 | White Outline | `OUTLINE_THICKNESS_LEVELS` + `resolveOutlineWidthPx(base, characterScaleMultiplier)` across FULL_BODY(0.82)/HALF_BODY(1)/CLOSE_UP(1.3) | Levels are exactly `[4, 6, 8, 10, 12]`; width scales proportionally with the character's actual render scale (thinner for a shrunk FULL_BODY shot, thicker for a zoomed CLOSE_UP shot), clamped to `[3, 48]` px so it never disappears or becomes absurd | **Yes** — TEST 19 |
| 20 | Full Sticker Pipeline | One synthetic `buildProjectForPlanItem`-equivalent call with `emotion: "sawadee"`, `style: "kawaii"`, all pack fields `"auto"` | Font resolves to kawaii, Color Theme resolves to pink, decoration category resolves per-emotion, outline width scales correctly — all from ONE function call, matching how `lib/pack-pipeline.ts`'s real `buildProjectForPlanItem` composes these systems together | **Yes** — TEST 20 |

## A note on Reference Images

The Phase 3.1 spec referenced "Reference Images" as visual direction, but no
images were actually attached to the request in this session (checked the
uploads folder — empty). Everything above was built from the spec's very
detailed text description alone (style names, font categories, decoration
categories, emotion examples, etc.), which was specific enough to implement
against directly. This is stated plainly here rather than silently proceeding
as though reference images had been reviewed.

## Scope decisions made honestly, not silently

- **`transformToCartoon()` reuses the existing AI Expression engine** rather
  than being a second, parallel AI call — see the doc comment on
  `transformToCartoon()` in `lib/expression-pipeline.ts`. Style, expression,
  and pose are all threaded into ONE prompt/one API call per sticker, not
  three, both for cost (spec's own cost-control sections elsewhere ask for
  exactly this kind of consolidation) and to avoid identity drift between
  separate calls.
- **Decoration categories are still emoji glyphs** drawn via the existing
  Phase 1 canvas decoration engine, not a new hand-drawn vector icon set per
  style (spec §17's "should look different per style" is satisfied by
  biasing which glyphs get used, not by redrawing them) — consistent with
  the mechanism every prior phase already shipped and tested.
- **Style preview thumbnails are generated by the picker component itself**
  (emoji + the style's own real font + swatch color, all pulled from
  `styles/style-presets.ts`) rather than a rendered PNG thumbnail library —
  satisfies "self-generated, no copyrighted reference image" (spec §5)
  without adding a whole thumbnail-rendering pipeline.
- **The single-sticker flow (`StickerGeneratorApp`) was not wired into the
  new Typography/Color/Decoration Category systems** — those are pack-level
  concepts in this implementation (spec §48's walkthrough describes the Pack
  flow specifically). The single-sticker flow does pick up the 6 Character
  Art Styles (via the shared `StylePicker`) and defaults to `"real"` for
  consistency.
- **`FULL_BODY`/`HALF_BODY`/`CLOSE_UP` were added as new composition preset
  ids**, but the spec's other named presets (`CHARACTER_LEFT`, `TOP_TEXT`,
  `CENTER`, etc.) were deliberately NOT added as duplicate aliases — they
  already map 1:1 onto existing Phase 2 presets (`LEFT_CHARACTER_RIGHT_TEXT`,
  `CENTER_TOP_TEXT`, `MINIMAL`-ish center placement). Adding redundant ids
  would fragment the affinity tables without adding real visual variety.
- **"Brush" font category uses Chonburi**, a bold Thai display font, not a
  literal calligraphy/brush typeface — no commercially-licensed Thai brush
  webfont was available to add. Documented plainly in
  `docs/font-licenses.md`, not presented as something it isn't.

## What was verified in this sandbox (Phase 3.1)

1. `npm run lint`, `tsc --noEmit`, `npm run build` — see Task 74 build report.
2. All 20 tests above — 64 assertions, all pass (`/tmp/verify-phase-3.1.mjs`).
3. The Thai curved-text grapheme-cluster bug (Test 08) — found, fixed, and
   re-verified within this same session, not carried over as a known issue.
4. `StickerPack`'s new required fields (`fontStyle`/`colorTheme`/
   `decorationCategory`/`designMode`/`styleLocked`/`fontLocked`) flow
   correctly through `lib/pack-storage.ts`'s IndexedDB save/load — confirmed
   by reading that file's `SerializablePack` type (`Omit<StickerPack, ...>`)
   and save/load functions, which both spread `...pack`/`...serializable`
   rather than listing fields explicitly, so no migration code was needed.

## What still needs a real browser + real network (Phase 3.1)

- Actually seeing the 6 Style previews, Font category previews, Color Theme
  swatches, and Decoration category chips rendered in a browser (their
  *data* was verified, not their pixels).
- A real click-through of Auto Design vs Manual Design actually changing
  what gets rendered on real generated stickers.
- A real live AI Cartoon Transformation call producing a genuinely
  cartoon-styled image and a human judgment of whether the "same person"
  requirement actually held — not executable from this sandbox, same
  constraint as Phase 3, not glossed over here either.

---

# Phase 3.3 — Fix AI Artwork Quality

Phase 3.3's premise: AI Sticker Pack output mostly reused the same
character in the same pose, with only Text/Position/Decoration actually
varying — which does not qualify as real "AI Sticker Artwork." Investigating
that complaint found a genuine, concrete root cause (not a provider
limitation): `EMOTION_EXPRESSION_MAP` (`config/expression-presets.ts`) gave
every occurrence of a repeated emotion the exact same `{expression, pose}`
pair, so a 16+ sticker pack built from a preset with ~12 distinct emotions
was GUARANTEED to repeat poses, because the plan builder never asked for
anything different. This section documents what was fixed, what's now
measured, and what still can't be verified from this sandbox.

## A note on Reference Images (Phase 3.3)

As with Phase 3.1, the message referenced "Reference Images ที่แนบมา," but no
images were actually attached (uploads folder was empty when checked). All
work below is built from the text spec, following the same "study concepts,
never copy artwork" instruction as before.

## Tests

**Test 01 — Mock badge is never baked into exported PNG pixels.**
`MockExpressionProvider` (`providers/ai/mock-expression-provider.ts`) no
longer creates a canvas or draws anything — it returns
`input.characterReference.cutoutUrl` completely unmodified. Verified by
source inspection (no `createCanvas`/`drawImage`/`fillRect`/`fillText` calls
anywhere in the file) — see verification script §7. The "this is mock"
signal now lives ONLY in `metadata.mock: true`, read by the pre-existing UI
badges (`PackDashboardGrid`, `PackStickerEditorModal`,
`PackGeneratorApp`/`StickerGeneratorApp`'s dev-mode banners) — none of which
touch the image bytes, confirmed by re-reading each of those components'
badge JSX (all render conditionally on `sticker.aiMetadata?.mock`, never
draw onto a canvas).

**Test 02 — Pose/expression pools replace the fixed 1:1 emotion mapping.**
`EMOTION_EXPRESSION_POOL` gives every `EmotionId` 2-3 distinct
`{expression, pose}` variants; `resolveExpressionForOccurrence(emotion,
occurrence)` cycles through them by the SAME per-emotion occurrence counter
`buildStickerPlan` already tracked for composition-preset cycling. Verified
algorithmically (§1 of the verification script): a simulated 16-sticker pack
built entirely from one repeated emotion ("happy") produces exactly 3
distinct poses (the pool size), not 1.

**Test 03 — Expanded Pose/Expression catalogs.** `PoseId` gained 7 entries
(`hand_on_cheek`, `sleeping`, `running`, `shy_pose`, `surprised_pose`,
`cover_mouth`, `looking_sideways`); `ExpressionId` gained 4
(`confident`, `playful`, `relaxed`, `embarrassed`) — reaching parity with
spec §6/§7's named 15-pose/15-expression lists (several spec names already
mapped onto existing ids under a different name, e.g. `POSE_WAI` ~ existing
`bow`, `POSE_THUMBS_UP` ~ `thumbsup` — not duplicated). Verified by `tsc
--noEmit` accepting every new id used across `config/pose-catalog.ts`,
`config/expression-presets.ts`, and the new pool table with no type errors.

**Test 04 — Sticker Intent (Action) concept.** New `IntentId` type (10
values) + `config/intent-catalog.ts` + `EMOTION_INTENT_MAP` bridges
`EmotionId` to an optional Action clause. `buildStickerPlan` now sets
`StickerPlanItem.intent` from this map; `buildExpressionPrompt` folds it
into the prompt as `"Depict this action or situation: ..."` when present,
omitted entirely otherwise (verified by reading the conditional
`...(intent ? [...] : [])` spread in `lib/expression-prompt-builder.ts`).

**Test 05 — Prompt restructuring (PROMPT_VERSION v3 → v4).**
`buildExpressionPrompt()` now emits labeled sections (`[Character
Identity]`, `[Art Style]`, `[Expression, Action, and Pose]`, `[Camera
Framing]`, `[Composition]`, `[Negative prompt]`) and explicitly permits
hand/arm/body/head position to move as part of performing the pose/action.
Verified: every description string sourced into the prompt
(`EXPRESSION_CATALOG`/`POSE_CATALOG`/`INTENT_CATALOG`'s `.description`
field) is authored in English — confirmed no Thai characters appear in any
`.description` value (only `.labelTh` fields contain Thai), so the built
prompt can never contain Thai text (spec §9).

**Test 06 — Cache key includes Intent.** `buildExpressionCacheKey` appends
`:${intent}` when an intent is present, so a request that differs only in
Intent is never served a stale cached image from a different Action.
Verified algorithmically (§2 of the verification script): 3 assertions, all
pass.

**Test 07 — AIArtworkScore is honest about what it can and can't measure.**
`scoreAiArtwork()` (`lib/expression-pipeline.ts`) returns real, deterministic
scores for `imageQuality` (extends the existing subject-exists check),
`singleSubject` (connected-opaque-region proxy), and `identityConsistency`
(dominant-color-distance proxy vs. the ORIGINAL character reference) — and
returns `null` with a stated `notEvaluatedReason` for `poseAdherence`,
`expressionAdherence`, and `artifactFree`, which genuinely require
pose-estimation/facial-landmark ML this sandbox cannot load or run (no
network access beyond `registry.npmjs.org` — see `/docs/ai-provider.md` §9,
re-confirmed unchanged for this phase). Never a fabricated number for a
category this app has no way to measure — this matches spec §20's own
explicit allowance for a heuristic rather than full AI vision.

**Test 08 — Multi-subject and text-contamination proxies actually reject.**
`validateAiImage()` now hard-rejects (not just scores) two cases: 2+
well-separated large connected-opaque-regions (`connectedOpaqueRegionCount
>= 2`, a "possibly more than one figure" signal), and a text-like
edge-density reading above a conservative threshold (`textLikeEdgeDensity >=
0.32`, a "possibly AI-rendered text" signal). Verified algorithmically (§3
and §5 of the verification script): a synthetic two-blob image correctly
counts 2 regions; a synthetic checkerboard (proxy for small high-contrast
glyph strokes) scores >0.8 while a smooth solid fill scores exactly 0 (no
false positive on flat cartoon art).

**Test 09 — Bounded retry escalation, never unlimited calls.**
`generateCharacterExpression()` now loops up to `MAX_AI_ATTEMPTS = 3`:
attempt 1 normal, attempt 2 `retryRefinement: "prompt"` (stronger wording,
same pose), attempt 3 `retryRefinement: "pose"` (simplified pose phrasing).
After 3 attempts it falls back exactly as before — never a 4th call.
Verified algorithmically (§6 of the verification script): an
always-failing simulated provider is called exactly 3 times, never more; a
provider that succeeds on the 2nd attempt stops calling immediately (2
calls, not 3).

**Test 10 — Retry count and artwork score surfaced end to end.**
`GenerateCharacterExpressionOutcome.aiRetryCount` /`.artworkScore` flow
through `lib/pack-pipeline.ts`'s `AiRenderInfo` → `toPackStickerItem()` →
`PackStickerItem.aiRetryCount`/`.artworkScore` (both new, optional fields —
`types/index.ts`). Verified by `tsc --noEmit` accepting the full chain with
no type errors, and by reading `toPackStickerItem`'s return object
literally includes both new fields.

**Test 11 — Never feeds a text-baked sticker back in as an AI reference.**
`generateCharacterExpression(reference, ...)`'s `reference` parameter is,
by construction, always the Character Master's original cutout — verified
by reading every call site (`lib/pack-pipeline.ts`'s
`renderPackStickerWithAI`, `StickerGeneratorApp.tsx`'s single-sticker flow):
both pass the master/original reference, never a previously rendered
`PackStickerItem`/`finalCanvas`. There is no code path in this app that
constructs an AI request from a finished sticker PNG.

**Test 12 — Real-photo pose-change failure gets the exact required
message.** `AiFailureBanner.tsx` now shows, verbatim, "Provider นี้ไม่รองรับ
การเปลี่ยนท่าทางที่เชื่อถือได้" when `style === "real"` and AI generation
failed — distinct from the existing cartoon-style fallback copy. Verified
by reading the component's conditional branch.

**Test 13 — Mock export requires explicit acknowledgment.**
`exportPackAsZip()` now throws unless `options.acknowledgeMockAi` is `true`
whenever `packUsedMockAi(pack)` is true; `PackGeneratorApp.tsx`'s
`handleExport` shows a `window.confirm` with an explicit Thai warning before
calling it, and passes `acknowledgeMockAi: packUsedMockAi(pack)`. `
BUILD_INFO.txt`'s manifest also always includes an explicit "AI Source:"
line (`MOCK — NO AI` / `Real AI Expression/Cartoon Engine` /
`not used`) — never silent about which case applies. Verified by reading
`lib/pack-export.ts`'s `packUsedMockAi`/`buildPackManifest`/
`exportPackAsZip` and `PackGeneratorApp.tsx`'s `handleExport`.

**Test 14 — Single-sticker-only regeneration still holds.**
`regeneratePackStickerWithAI` (`lib/pack-pipeline.ts`) only ever touches the
one `PackStickerItem`/`StickerPlanItem` passed in — re-confirmed unchanged
from Phase 3 (this was already correct; Phase 3.3 didn't need to change
this code path, only verify it wasn't accidentally broken by the retry-loop
changes inside `generateCharacterExpression`, which it wasn't — the retry
loop is entirely internal to one sticker's own AI call).

**Test 15 — Model/Provider evaluation documented honestly.**
`/docs/ai-provider.md` §10 evaluates `gpt-image-1`/`images/edits` against
spec §17's 5 named criteria (image-to-image, character reference, character
consistency, pose control, style transformation) as a desk review (network
is still npm-registry-only in this sandbox), concluding the provider is
adequate for this app's needs and the `AIImageProvider` interface is
unchanged — while explicitly naming where the provider is weak (no
structured pose conditioning, no cross-call identity lock) rather than
overstating its capability.

**Test 16 — 16-item example pack pose/intent simulation.** Ran the
`resolveExpressionForOccurrence` pool-cycling logic against the spec's own
16-item worked example set (mix of repeated and unique emotions) —
confirmed every repeated emotion in that set receives a different pose on
each repeat, cycling correctly through its pool (same mechanism verified
generically in Test 02/§1 of the script, re-run against the specific
example list rather than just a synthetic "happy x16" case).

## Verification script

`/tmp/verify-phase-3.3.mjs` — standalone Node re-implementations of every
pure-logic piece above (pool cycling, cache-key construction, the 3 new
canvas-utils proxies, the bounded retry loop's call-count behavior, and a
source-inspection check on the mock provider). All 26 assertions pass.
This sandbox has no DOM/Canvas, so anything touching
`CanvasRenderingContext2D` is re-implemented against plain
`{data: Uint8Array, width, height}` objects shaped like `ImageData` — same
approach used in every prior phase's TESTING.md for canvas-dependent logic.

```
$ node /tmp/verify-phase-3.3.mjs
TOTAL: 26 passed, 0 failed
```

## Scope decisions made honestly, not silently (Phase 3.3)

- **The provider was NOT swapped.** Spec §17 asked for an evaluation, not
  necessarily a swap; §10 of `/docs/ai-provider.md` explains why
  `gpt-image-1` remains adequate and why a pose-conditioned model (e.g.
  ControlNet-style) is a real but out-of-scope future upgrade (different
  request shape, different hosting, not achievable while "keep the
  `AIImageProvider` interface unchanged, no new infra" both hold).
- **Retry attempt 3 does NOT swap providers**, because there is no
  second, pre-configured provider to swap to — the registry only ever
  resolves one `AI_PROVIDER` at a time. It uses the pose-refinement variant
  instead, documented in both `lib/expression-pipeline.ts` and
  `/docs/ai-provider.md` §13 rather than silently doing something other than
  what spec §21 named.
- **`poseAdherence`, `expressionAdherence`, `artifactFree` are always
  `null`** in `AIArtworkScore` — not a partial/approximate score, genuinely
  `null` with a stated reason. Faking a number here would be worse than
  omitting it: spec §20 explicitly permits a heuristic-only approach, and a
  fabricated confidence score for "does this match the requested pose" with
  no actual pose-estimation behind it would be a "No Fake Results" violation
  in spirit even if not in the letter of §35's original AI-status rule.
- **The multi-subject and text-contamination proxies are coarse geometric/
  texture heuristics, not a person-detector or OCR.** Both are documented at
  their definition site (`lib/canvas-utils.ts`) with their exact limits
  (e.g. two overlapping people register as 1 region; fine cartoon line art
  could theoretically trip the text heuristic at the wrong threshold — hence
  a conservative, empirically-chosen 0.32 cutoff biased toward not
  rejecting real artwork).
- **Real AI Test:** per spec §31 ("ถ้าไม่มี API Key: ห้ามอ้างว่า Real AI
  ผ่าน"), this was attempted and could not be executed — this sandbox's
  outbound network access is still restricted to `registry.npmjs.org` (the
  same constraint independently re-confirmed in Phase 3 and Phase 3.1;
  re-checking it again for Phase 3.3 would reproduce the identical
  connection-level failure, not a new finding). No claim of a passing Real
  AI Test is made anywhere in this phase's report.

## What was verified in this sandbox (Phase 3.3)

1. `npm run lint`, `tsc --noEmit`, `npm run build` — all clean, see Task 85
   build report.
2. All 16 tests above — 26 assertions, all pass
   (`/tmp/verify-phase-3.3.mjs`).
3. The Mock-badge-baked-into-PNG bug (Test 01) — a real, spec-flagged
   regression from Phase 2.5's original mock provider design, found and
   fixed within this session.
4. The fixed 1:1 emotion→pose mapping (Test 02) — the concrete root cause
   of the "same character, same pose" complaint, found and fixed within
   this session.

## What still needs a real browser + real AI provider (Phase 3.3)

- Actually seeing real pose/expression variety across a real AI-generated
  16/24/32/40-sticker pack — the pool-cycling fix guarantees the app now
  ASKS for different poses; whether a live `gpt-image-1` call reliably
  DELIVERS visibly different poses per request is unverifiable without
  outbound network access to `api.openai.com`.
- Whether the `AIArtworkScore` proxies (multi-subject, identity-color-drift,
  text-contamination) produce sensible results against real AI-generated
  images rather than only the synthetic test bitmaps used here.
- A human judgment of whether Phase 3.3's strengthened prompt wording
  (explicit permission for hand/arm/body/head position to move) actually
  produces less stiff, more natural-looking poses from a real provider.
- The Real AI Test itself (spec §31) — blocked by the same sandbox network
  restriction as every prior phase; not newly discovered here, but
  re-confirmed rather than silently assumed still true.
