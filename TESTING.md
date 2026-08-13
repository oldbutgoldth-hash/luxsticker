# LUXSTICKER AI — Phase 1.1 Test Plan

Manual test plan for **LINE Ready Export + Auto Crop + Quality Validation**.
Run these in a real browser (`npm run dev`) — background removal (WASM
model) and Google Fonts both need real internet access, which this
sandbox's build environment does not have. Where noted, a case's *geometry
logic* was verified numerically instead (see "Sandbox-verified" column).

Profile under test: `LINE_STICKER` — ≤370×320px, even dimensions, ≤1MB PNG,
transparent, ≥10px padding around content.

| # | Case | Steps | Expected | Sandbox-verified |
|---|------|-------|----------|-------------------|
| 01 | Plain-background portrait | Upload a person photo with a flat/simple background | Background removed cleanly, sticker generates, final card shows ✓ READY TO USE | Build/type-check only — needs a browser for the actual AI cutout |
| 02 | Full-body photo | Upload a full-body portrait | Character not clipped; `content-clipping` check passes | Composition math (character scale-down when >62% of canvas) covered by existing engine logic; needs visual check |
| 03 | Landscape photo | Upload a wide/horizontal photo | Auto-composition still places text opposite the character without overlap | Same composition-engine as Phase 1 (unchanged this phase) |
| 04 | Long text | Enter a long custom sentence | Text auto-shrinks (composition engine's shrink-until-clear loop) and is never cut off; `content-clipping` still passes | Logic unchanged from Phase 1; re-verified by type-check |
| 05 | Short text | Enter e.g. "โอเค" | Text renders large and readable (no unnecessary shrink) | Not independently re-tested this phase (unchanged code path) |
| 06 | Character + decorations | Generate with any style (auto-adds 2-4 decorations) | No decoration/text/character bounding-box collisions | Unchanged decoration-engine collision avoidance from Phase 1 |
| 07 | Content bigger than 370×320 | Upload/compose so content bbox exceeds the LINE bounds | `cropAndFitToBounds` scales proportionally (never stretches) down to fit, aspect ratio preserved | **Yes** — numerically verified: 500×250 content → scaled to 344×172 inside a 370×198 canvas, aspect ratio 2.0000 → 2.0000 exactly; 2000×2000 → 294×294 inside 320×320. See `/tmp/verify-crop-math.mjs` run in this session. |
| 08 | Odd final dimension | Any content whose padded size rounds to an odd number | `toEvenClamp` rounds to the nearest even number, rounding down if rounding up would exceed the profile max | **Yes** — verified all 5 geometry cases above always land on even width/height, e.g. 300×300 content → final 320×320 |
| 09 | Background removal failure | Force `isFallbackCutout: true` (e.g. offline/unsupported photo) | `background-removal` check fails → overall `validation.passed = false` → Download button disabled → dedicated "⚠️ BACKGROUND REMOVAL FAILED" card shown with **ลองตัดพื้นหลังอีกครั้ง** / **เลือกรูปใหม่**, no auto-fix attempted | **Yes** — confirmed by code path: `normalizeForProfile`'s auto-fix loop explicitly excludes `background-removal` from `AUTO_FIXABLE_CHECK_IDS`, and `ExportStatusCard` special-cases `isFallbackCutout` before the generic ready/not-ready branches |
| 10 | File > 1MB | Force a large/noisy composited canvas | `normalizeForProfile`'s auto-fix loop shrinks the canvas (×0.88 per attempt, up to 4 attempts) until `file-size` passes, or gives up and reports NOT READY with the reason listed | Retry-loop logic verified by type-check + code review; real-world PNG byte sizes need a browser to confirm exact KB numbers |

## What was verified in this sandbox (no real browser available)

1. `npx tsc --noEmit` — clean, no errors.
2. `npx eslint .` — clean, no errors/warnings.
3. `npm run build` (Next.js production build, Turbopack) — clean.
4. Crop/fit geometry (`cropAndFitToBounds` + `toEvenClamp`) re-implemented as a
   standalone Node script and run against 5 scenarios (square, the spec's own
   500×250 example, small content, a 2000×2000 extreme, and a tall image) —
   all preserve aspect ratio exactly, land within 370×320, and produce even
   dimensions with ≥10px padding.
5. Manual code-path trace confirms background-removal failures and pre-crop
   content clipping are excluded from the auto-fix retry loop (§9 requirement
   that these are never "fixed" silently).

## What still needs a real browser

- Actual AI background removal quality (`@imgly/background-removal` fetches
  its ONNX model from a CDN at runtime — blocked by this sandbox's network
  allowlist, works normally for end users).
- Visual confirmation of the editor's drag/resize/rotate/zoom interactions
  (unchanged this phase, but worth a smoke test after pulling these changes).
- Real PNG byte sizes for the file-size auto-fix loop (test case 10).
