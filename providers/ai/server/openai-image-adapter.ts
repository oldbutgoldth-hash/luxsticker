// ============================================================================
// OpenAI gpt-image-1 adapter (Phase 3 §3/§4/§6). SERVER-ONLY — this file
// must never be imported from client code (nothing under components/ or any
// "use client" file imports it; only app/api/generate-expression/route.ts
// does). It's the one place that actually calls out to OpenAI's Images API
// with the real `AI_PROVIDER_API_KEY`.
//
// Chosen for Phase 3's MVP (spec §6) because gpt-image-1's `images/edits`
// endpoint is a genuine image-to-image workflow: it accepts a reference
// image plus a text prompt and returns an edited image, which is exactly
// "same character, new expression/pose" — not a text-to-image call that
// would have no way to anchor on the uploaded photo at all. It also
// natively supports `background: "transparent"` output, which lines up with
// this app's sticker-character workflow (spec §16), and needs only a single
// API key (no separate account/region setup), which keeps the adapter small.
// This is a reasoned MVP pick, not a "biggest name" pick (spec §6) — a
// different vendor can be swapped in later by adding one more branch in the
// route handler; nothing else in the app depends on which vendor this is.
// ============================================================================

const OPENAI_IMAGES_EDITS_URL = "https://api.openai.com/v1/images/edits";
const DEFAULT_MODEL = "gpt-image-1";
const DEFAULT_SIZE = "1024x1024";
const REQUEST_TIMEOUT_MS = 60_000;

export type OpenAiAdapterErrorKind = "invalid_key" | "rate_limited" | "timeout" | "network" | "provider_error" | "invalid_response";

/**
 * Thrown for every failure mode. `kind` is what the route handler uses to
 * pick a safe, sanitized user-facing message (spec §29) — `technicalDetail`
 * is kept separate specifically so it can be logged server-side / shown only
 * in development, and is never included in the thing this error's `message`
 * exposes to a JSON response by default.
 */
export class OpenAiAdapterError extends Error {
  constructor(
    message: string,
    public readonly kind: OpenAiAdapterErrorKind,
    public readonly technicalDetail?: string
  ) {
    super(message);
    this.name = "OpenAiAdapterError";
  }
}

export interface OpenAiImageEditInput {
  /** `data:image/...;base64,...` — a fully self-contained reference image
   * (never a browser blob: URL — the server can't resolve those). */
  imageDataUrl: string;
  prompt: string;
  apiKey: string;
  model?: string;
  size?: string;
}

export interface OpenAiImageEditResult {
  /** `data:image/png;base64,...` */
  cutoutUrl: string;
  width: number;
  height: number;
  hasTransparency: boolean;
  requestId?: string;
  durationMs: number;
}

function parseDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    throw new OpenAiAdapterError("ภาพอ้างอิงตัวละครไม่ถูกต้อง", "invalid_response", "reference image was not a valid data: URL");
  }
  return { mimeType: match[1], buffer: Buffer.from(match[2], "base64") };
}

function parseSize(size: string): { width: number; height: number } {
  const match = /^(\d+)x(\d+)$/.exec(size);
  if (!match) return { width: 1024, height: 1024 };
  return { width: Number(match[1]), height: Number(match[2]) };
}

/**
 * Calls OpenAI's `images/edits` endpoint with the character reference as the
 * input image and the (already spec-§12/§13-compliant) prompt built by
 * `lib/expression-prompt-builder.ts`. Requests a transparent PNG directly
 * (spec §16) — the caller (app/api/generate-expression/route.ts ->
 * lib/expression-pipeline.ts) still treats that as provisional, not
 * guaranteed, and the existing Validation Engine is the real backstop.
 */
export async function generateWithOpenAiImages(input: OpenAiImageEditInput): Promise<OpenAiImageEditResult> {
  const model = input.model?.trim() || DEFAULT_MODEL;
  const size = input.size?.trim() || DEFAULT_SIZE;
  const { mimeType, buffer } = parseDataUrl(input.imageDataUrl);

  const form = new FormData();
  form.append("model", model);
  form.append("prompt", input.prompt);
  form.append("size", size);
  form.append("background", "transparent");
  form.append("n", "1");
  // Node 18+/20+ FormData accepts a Blob; Next.js's server runtime provides
  // a global Blob, so this works without any extra multipart library.
  // `Buffer`'s `ArrayBufferLike` (which can be a `SharedArrayBuffer`) isn't
  // assignable to `BlobPart`'s `ArrayBuffer`-only expectation, so copy into
  // a plain `Uint8Array` backed by a fresh `ArrayBuffer` first.
  const imageBytes = new Uint8Array(buffer.byteLength);
  imageBytes.set(buffer);
  form.append("image", new Blob([imageBytes], { type: mimeType }), "character-reference.png");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const started = Date.now();

  let response: Response;
  try {
    response = await fetch(OPENAI_IMAGES_EDITS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${input.apiKey}` },
      body: form,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new OpenAiAdapterError("AI ใช้เวลานานเกินไป กรุณาลองใหม่", "timeout", "request aborted after timeout");
    }
    throw new OpenAiAdapterError("ไม่สามารถติดต่อ AI Provider ได้ ลองใหม่อีกครั้ง", "network", err instanceof Error ? err.message : String(err));
  } finally {
    clearTimeout(timeout);
  }

  const durationMs = Date.now() - started;
  const requestId = response.headers.get("x-request-id") ?? undefined;

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    if (response.status === 401 || response.status === 403) {
      throw new OpenAiAdapterError("AI Provider ยังไม่ได้ตั้งค่าอย่างถูกต้อง", "invalid_key", `HTTP ${response.status}: ${bodyText}`);
    }
    if (response.status === 429) {
      throw new OpenAiAdapterError("AI กำลังถูกใช้งานหนาแน่น กรุณาลองใหม่", "rate_limited", `HTTP 429: ${bodyText}`);
    }
    throw new OpenAiAdapterError("ไม่สามารถสร้างภาพนี้ได้ กรุณาลองใหม่", "provider_error", `HTTP ${response.status}: ${bodyText}`);
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (err) {
    throw new OpenAiAdapterError(
      "ไม่สามารถอ่านผลลัพธ์จาก AI ได้",
      "invalid_response",
      err instanceof Error ? err.message : String(err)
    );
  }

  const b64 = (json as { data?: Array<{ b64_json?: string }> })?.data?.[0]?.b64_json;
  if (!b64) {
    throw new OpenAiAdapterError("AI ไม่ส่งภาพกลับมา กรุณาลองใหม่", "invalid_response", "response JSON missing data[0].b64_json");
  }

  const { width, height } = parseSize(size);
  return {
    cutoutUrl: `data:image/png;base64,${b64}`,
    width,
    height,
    hasTransparency: true, // requested background=transparent — still re-checked by the app's Validation Engine downstream, never trusted blindly (spec §16)
    requestId,
    durationMs,
  };
}
