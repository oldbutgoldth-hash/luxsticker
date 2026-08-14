# AI Provider — LUXSTICKER AI Phase 3

This document covers the real AI Expression Engine added in Phase 3: which
vendor is wired in, how the request/response flow works end to end, the
environment variables that control it, error handling, cost control, and —
per the project's explicit honesty requirement — what could and could not be
verified from the environment this code was built in.

## 1. Provider and model

**Vendor:** OpenAI
**Model:** `gpt-image-1`
**Endpoint:** `POST https://api.openai.com/v1/images/edits`

`images/edits` is a genuine image-to-image call: it takes a reference image
plus a text prompt and returns an edited image, which matches this app's
actual need ("same character, new expression/pose") far better than a
text-to-image endpoint would, since text-to-image has no way to anchor on the
user's uploaded photo at all. It also natively supports
`background: "transparent"` output, and needs only a single API key with no
separate account/region setup, which keeps the adapter small.

This was a reasoned pick for the MVP against the project's actual
requirements (image-to-image, character reference, transparent-friendly
output, single API key, Thai sticker workflow), not a "pick the biggest
name" decision — see the option the user was given and selected in-session
(OpenAI `gpt-image-1` over Gemini 2.5 Flash Image). Swapping in a different
vendor later is additive: it's one more `if (providerName === "...")` branch
in `app/api/generate-expression/route.ts` plus one more file under
`providers/ai/server/`, and nothing else in the app (prompt builder, cache,
pipeline, UI) needs to change, because they all depend only on the
`AIImageProvider` interface, not on OpenAI specifically.

## 2. Environment variables

All of these live in `.env.example` (copy to `.env.local`, never commit the
real key anywhere).

| Variable | Where read | Purpose |
|---|---|---|
| `AI_MODE` | server only | Master switch: `mock` (default) or `real`. Checked **before** `AI_PROVIDER` in the API route — an `AI_PROVIDER` value left over from testing can never trigger a real, billed call while `AI_MODE` is still `mock`. |
| `AI_PROVIDER` | server only | Which vendor adapter to use when `AI_MODE=real`. Currently only `openai` has an adapter; any other value returns a clear 501, never silent failure. |
| `AI_MODEL` | server only | Model name passed to the adapter. Defaults to `gpt-image-1` if blank. |
| `AI_PROVIDER_API_KEY` | server only | The OpenAI API key. **Never** prefixed `NEXT_PUBLIC_*` — that would bundle it into client JS. Only read inside `app/api/generate-expression/route.ts`, never logged, never echoed in any API response, never written to LocalStorage/IndexedDB/ZIP/BUILD_INFO.txt. |
| `NEXT_PUBLIC_AI_MODE` | client | Non-secret mirror of `AI_MODE`, used for a client-side UI label only. |
| `NEXT_PUBLIC_AI_PROVIDER` | client | Non-secret mirror of `AI_PROVIDER`, same purpose. |

The client mirrors are informational only — the server independently
re-checks `AI_MODE`/`AI_PROVIDER`/`AI_PROVIDER_API_KEY` itself before ever
calling a real vendor, so a client/server mismatch fails safe (falls back to
mock/unavailable), never open (never accidentally calls a real, billed API
because the client thought it should).

If `AI_MODE=real` but `AI_PROVIDER` or `AI_PROVIDER_API_KEY` is missing, the
route returns HTTP 503 with the Thai message "AI Provider ยังไม่ได้ตั้งค่า"
rather than silently serving mock output. The client (`lib/ai-status.ts`)
polls a small non-secret `GET /api/generate-expression` status probe once on
mount and disables the "Use AI Expressions" toggle with the same message
before the user ever spends a generate click on it.

## 3. Request / response flow

1. **Client builds a character reference.** Either the Character Master
   (pack flow) or an ad-hoc reference built from the single-sticker
   `CharacterLayer` (`CharacterSource` + a computed `characterHash` — see
   §5) — both satisfy the same `CharacterReferenceSource` shape, so one
   engine (`lib/expression-pipeline.ts`'s `generateCharacterExpression()`)
   serves both flows.
2. **Cache check.** A cache key is built from
   `characterHash:emotion:pose:style:provider:model:promptVersion`
   (`lib/expression-cache.ts`). If a fresh (non-"Regenerate Fresh") request
   hits an existing entry, the cached image/metadata is returned immediately
   with no network call.
3. **Prompt build.** `lib/expression-prompt-builder.ts`'s
   `buildExpressionPrompt()` is the *only* place in the app that turns
   `{emotion, pose, style, composition}` into prompt text — every caller
   goes through it. See §4 for what it forbids.
4. **Client → server.** `providers/ai/remote-expression-provider.ts`
   resolves the character reference's `cutoutUrl` to a self-contained
   `data:image/...;base64,...` URL (via `fetch()` + `FileReader`) if it's
   currently a `blob:` object URL — a Node server process can't resolve a
   browser blob URL, so this conversion has to happen client-side before the
   POST. It then `POST`s `{characterReference, emotion, pose, style, prompt}`
   as JSON to `/api/generate-expression`.
5. **Server route.** `app/api/generate-expression/route.ts` checks
   `AI_MODE`. If not `"real"`, it returns a mock passthrough (matching
   `MockExpressionProvider`'s shape, for direct route testing only — the
   live app never actually reaches this branch, since the client resolves
   mock mode to the mock provider directly and skips the network call
   entirely). If `"real"` and `AI_PROVIDER=openai`, it calls
   `generateWithOpenAiImages()`.
6. **OpenAI adapter.** `providers/ai/server/openai-image-adapter.ts` parses
   the `data:` URL into raw bytes, builds a multipart `FormData` with
   `model`, `prompt`, `size`, `background: "transparent"`, `n: 1`, and the
   reference image as a `Blob`, then `fetch()`s the `images/edits` endpoint
   with a 60-second timeout (`AbortController`). On success it reads
   `data[0].b64_json` from the JSON response and returns
   `{cutoutUrl: "data:image/png;base64,...", width, height, hasTransparency: true, durationMs}`.
7. **Server → client response.** The route maps that into
   `ExpressionGenerationResult { image, metadata: { provider, model, generationTimeMs, mock: false } }`.
8. **Post-processing (client, `generateCharacterExpression`).** Even though
   the request asked for a transparent background, the result is **never
   trusted blindly** (spec §16): if `hasTransparency` is somehow false, it's
   routed through the app's own existing background-removal engine first.
   Then it goes through an image quality gate (§6 below). Only after both
   pass does it get cached and handed back as a `CharacterSource` ready to
   re-enter the *existing* sticker pipeline (Background Removal →
   Character Extraction → Outline → Text → Decoration → Composition → Auto
   Crop → LINE Normalizer → Validation) — the AI image is never exported
   directly.

## 4. Prompt engine — no AI-generated text

`buildExpressionPrompt()` always appends `"Do not render any text, letters,
or words in the image."` to its negative-directive list. This is
deliberate and non-negotiable: AI image models routinely render Thai text
incorrectly (wrong glyphs, garbled characters), so **all sticker text is
drawn by this app's own Canvas Text Engine, always applied after the AI
image comes back** — the AI is never asked to render the sticker's caption
itself. The rest of the prompt is a fixed structure: positive preservation
directives first (identity, hairstyle, skin tone, body proportions,
clothing, accessories), then the one thing allowed to change (expression +
pose text pulled from `config/expression-presets.ts` /
`config/pose-catalog.ts`), then a negative list (no identity change, no
extra people/limbs, no background, no text).

`PROMPT_VERSION` (currently `"v2"`) is bumped whenever this structure or
wording changes materially, and is part of the cache key — a prompt-wording
change can never silently serve an image generated under the old prompt.

## 5. Character reference package

`CharacterReferenceSource` (`types/index.ts`) is the shape passed into
`generateCharacterExpression()` / the provider:

```ts
type CharacterSource = Pick<CharacterMaster,
  "originalUrl" | "cutoutUrl" | "naturalWidth" | "naturalHeight" | "isFallbackCutout">;

type CharacterReferenceSource = CharacterSource & { characterHash: string };
```

- `originalUrl` — the user's original uploaded photo.
- `cutoutUrl` — the current transparent-background cutout (the actual image
  bytes sent to the AI as the edit-reference).
- `naturalWidth` / `naturalHeight` — dimensions.
- `isFallbackCutout` — whether background removal itself had already fallen
  back (Phase 1 behavior, untouched).
- `characterHash` — a deterministic FNV-1a hash of sampled cutout pixel data
  (`lib/character-hash.ts`), computed once per Character Master and reused
  as the identity component of the AI expression cache key. It changes only
  when the user uploads a new photo.

Both the pack flow (`CharacterMaster`, which structurally satisfies this
type) and the single-sticker flow (which builds one ad hoc from its
`CharacterLayer` + a computed hash) construct the same shape, so one engine
serves both — no duplicated AI-calling logic per spec's "don't build the
engine twice" requirement.

## 6. Image quality gate

Every AI result — mock or real — passes through `validateAiImage()` in
`lib/expression-pipeline.ts` before it's allowed to become a
`CharacterSource`:

- **Resolution check** — width/height must both be at least 32px.
- **Decode check** — the image must actually load (`loadImage()`); a
  corrupt or invalid response is caught here and reported as a quality
  failure, not a raw decode exception.
- **Subject-exists check** — the image is drawn onto a 128×128 sample
  canvas and its opaque-pixel bounding box is measured
  (`alphaBoundingBox`, reused from the existing `canvas-utils.ts`, sample
  threshold 8). If the opaque area is below 2% of the sample canvas, it's
  treated as "no real character" (an all-transparent or near-empty AI
  output), not a usable result.

Any failure here throws, which `generateCharacterExpression()`'s
`catch` block turns into `aiStatus: "AI_FAILED"` + `characterMode:
"original_character"` — the same fallback path used for a network error or
a provider error. The Validation Engine downstream (Phase 1, unmodified)
still runs on top of this regardless.

## 7. Error handling and sanitization

`OpenAiAdapterError` classifies every failure into a `kind`:
`invalid_key | rate_limited | timeout | network | provider_error |
invalid_response`. The API route maps `kind` to an HTTP status
(`rate_limited` → 429, `timeout` → 504, `invalid_key` → 503, else 502) and a
**generic Thai message** (e.g. "AI กำลังถูกใช้งานหนาแน่น กรุณาลองใหม่" for
rate limiting) — the raw HTTP status code, OpenAI's own error body, and any
stack trace are never sent to the browser. A `technicalDetail` field is
attached to the JSON response only when `NODE_ENV !== "production"`, purely
for local debugging; production responses never include it. The same
`sanitizedError()` helper is used for every error path in the route,
including malformed request bodies and the "not configured" case, so
there's a single place that owns "what the client is ever allowed to see."

One sticker's AI failure is caught inside `generateCharacterExpression()`
and never thrown out of it — `lib/pack-pipeline.ts`'s per-item worker also
wraps its own try/catch around each sticker, so a single failure (network,
quality-gate, whatever) never stops the rest of a pack's queue.

## 8. Cost control

- **Cache-first.** Identical `{characterHash, emotion, pose, style,
  provider, model, promptVersion}` requests never re-call the vendor.
- **Only Expression/Pose/Character calls hit the AI.** Changes to
  text/font/position/size/outline/decoration/canvas placement never trigger
  a new AI call — those are handled entirely by the existing Phase 1/2
  canvas pipeline.
- **Bounded concurrency.** Pack batch generation runs through
  `lib/concurrency.ts`'s `runWithConcurrencyLimit()`, default concurrency 3
  (`DEFAULT_AI_CONCURRENCY`) — a 40-sticker pack never fires 40 requests at
  once. This applies only to the AI-calling path; the non-AI Phase 2 render
  loop is untouched and stays fully sequential.
- **Explicit Regenerate Fresh.** Cache is bypassed only when the user
  explicitly clicks Regenerate on a specific sticker (`forceFresh: true`),
  never automatically.
- **Cost preview before generation.** The pack wizard shows an estimated
  AI-call count before the user commits to generating (Phase 2.5, carried
  forward unchanged).
- **Dev-mode usage display.** `generationTimeMs` and provider/model are
  available in the response metadata for a development-only usage/cost
  display; production UI doesn't surface raw cost figures.

## 9. What was and was not verified

Per the project's explicit instruction not to solve this with mock output
labeled as real, and to stop and report clearly if the provider can't
actually be reached from this environment:

**This sandbox's outbound network access is restricted to
`registry.npmjs.org`.** Direct `curl` tests to OpenAI's API, Google's
Generative Language API, Replicate, Stability, and fal.ai all returned an
immediate connection failure (`HTTP_STATUS:000`, ~1ms — a network-level
block, not an auth or DNS error), while the npm registry returned `HTTP
200`. This was confirmed and reported to the user before any adapter code
was written, and the user chose (via an explicit in-session decision) to
have the real adapter built anyway, with the understanding that it could
not be exercised against the live OpenAI API from here.

**Verified in this environment:**
- The adapter's request construction (multipart form fields, headers,
  timeout/abort wiring), response parsing (`data[0].b64_json` extraction),
  and error classification logic — via `tsc --noEmit` type-checking and
  code review, not a live call.
- The full non-network code path: prompt building, cache key
  construction/lookup, the image quality gate, the concurrency limiter's
  max-in-flight behavior, and the mock-mode passthrough — all algorithmically
  re-verified with standalone Node scripts (see `TESTING.md`, Phase 3
  section).
- That the API key never appears in client-side bundle output (`.next/static`
  grep, same method used in every prior phase).

**NOT verified (cannot be, from this sandbox):**
- Whether `POST https://api.openai.com/v1/images/edits` actually accepts
  this exact request shape and returns the expected response shape from the
  real, live API.
- Actual generated-image quality, or real character-consistency behavior
  (face/hair/clothing/identity preservation) across real example photos.
- Real-world latency, actual per-image cost, or how OpenAI's real rate
  limiting behaves in practice.

Anyone deploying this needs to set `AI_MODE=real`, `AI_PROVIDER=openai`,
`AI_PROVIDER_API_KEY=<a real key>` in an environment with outbound access to
`api.openai.com`, and run a real end-to-end test (the app's own `GET
/api/generate-expression` status probe is a good first check that
configuration was picked up) before trusting this in production.
