import { NextResponse } from "next/server";
import type { ExpressionGenerationInput, ExpressionGenerationResult } from "@/providers/ai/types";
import { generateWithOpenAiImages, OpenAiAdapterError } from "@/providers/ai/server/openai-image-adapter";

// ============================================================================
// Server-side AI Expression route (spec §3/§5/§7 Phase 2.5; §30-34 Phase 3).
// This is the ONLY place in the whole app allowed to read
// `AI_PROVIDER_API_KEY` — a plain server environment variable (never
// `NEXT_PUBLIC_AI_PROVIDER_API_KEY`), so Next.js never bundles it into any
// client JS. The client's RemoteExpressionProvider only ever sees this
// route's JSON response, never the key itself, never even its
// presence/absence in a way that reveals the value (spec §5/§28: no API key
// in client, LocalStorage, IndexedDB, ZIP, BUILD_INFO.txt, or console).
//
// AI_MODE ("mock" | "real") is the master switch — checked BEFORE
// AI_PROVIDER, so an AI_PROVIDER value left over from testing can never
// accidentally trigger a real (billed) call while AI_MODE is still "mock"
// (spec §31: "Default Development: mock").
// ============================================================================

function resolveServerAiMode(): "mock" | "real" {
  return process.env.AI_MODE?.trim().toLowerCase() === "real" ? "real" : "mock";
}

function isDev(): boolean {
  return process.env.NODE_ENV !== "production";
}

/** Spec §29 — never return a raw provider error to the client. `detail` is
 * only attached in development, purely for the person building this app to
 * debug locally; production responses never include it. */
function sanitizedError(message: string, status: number, detail?: string) {
  const body: { error: string; detail?: string } = { error: message };
  if (isDev() && detail) body.detail = detail;
  return NextResponse.json(body, { status });
}

/**
 * GET — a small, non-secret status probe (Phase 3 addition) so the client
 * can proactively disable "Use AI Expressions" and show "AI Provider
 * ยังไม่ได้ตั้งค่า" (spec §33) BEFORE the user spends a generate click on it,
 * instead of only finding out after every sticker in a pack fails. Never
 * reveals the key itself — only whether one is present.
 */
export async function GET() {
  const mode = resolveServerAiMode();
  const provider = process.env.AI_PROVIDER?.trim() || "mock";
  const model = process.env.AI_MODEL?.trim() || undefined;
  const configured = mode === "mock" || (provider === "openai" && Boolean(process.env.AI_PROVIDER_API_KEY));
  return NextResponse.json({ mode, provider: mode === "real" ? provider : "mock", model, configured });
}

export async function POST(request: Request) {
  let input: ExpressionGenerationInput;
  try {
    input = (await request.json()) as ExpressionGenerationInput;
  } catch {
    return sanitizedError("คำขอไม่ถูกต้อง", 400);
  }

  const mode = resolveServerAiMode();

  if (mode !== "real") {
    // Best-effort server-side mirror of MockExpressionProvider, for direct
    // route testing only. The live app never actually reaches this branch —
    // the client resolves mock mode to providers/ai/mock-expression-provider.ts
    // directly and never calls this route at all when AI_MODE isn't "real".
    const result: ExpressionGenerationResult = {
      image: {
        cutoutUrl: input.characterReference.cutoutUrl,
        width: input.characterReference.naturalWidth,
        height: input.characterReference.naturalHeight,
        hasTransparency: true,
      },
      metadata: { provider: "mock", model: "mock-expression-v1", generationTimeMs: 0, mock: true },
    };
    return NextResponse.json(result);
  }

  const providerName = process.env.AI_PROVIDER?.trim() || "";
  const apiKey = process.env.AI_PROVIDER_API_KEY;

  if (!providerName || !apiKey) {
    // Spec §33 — "ห้ามเงียบ แสดง 'AI Provider ยังไม่ได้ตั้งค่า'". Deliberately
    // vague beyond that: never confirms which of AI_PROVIDER/AI_PROVIDER_API_KEY
    // is missing, never echoes env var values.
    return sanitizedError("AI Provider ยังไม่ได้ตั้งค่า", 503);
  }

  if (providerName === "openai") {
    const model = process.env.AI_MODEL?.trim() || undefined;
    try {
      const result = await generateWithOpenAiImages({
        imageDataUrl: input.characterReference.cutoutUrl,
        prompt: input.prompt,
        apiKey,
        model,
      });
      const response: ExpressionGenerationResult = {
        image: { cutoutUrl: result.cutoutUrl, width: result.width, height: result.height, hasTransparency: result.hasTransparency },
        metadata: {
          provider: "openai",
          model: model || "gpt-image-1",
          generationTimeMs: result.durationMs,
          mock: false,
        },
      };
      return NextResponse.json(response);
    } catch (err) {
      if (err instanceof OpenAiAdapterError) {
        const status = err.kind === "rate_limited" ? 429 : err.kind === "timeout" ? 504 : err.kind === "invalid_key" ? 503 : 502;
        // Server-side log only — never sent to the client outside dev mode.
        console.error(`[generate-expression] OpenAI adapter failed (${err.kind}):`, err.technicalDetail ?? err.message);
        return sanitizedError(err.message, status, err.technicalDetail);
      }
      console.error("[generate-expression] unexpected error calling OpenAI adapter:", err);
      return sanitizedError("ไม่สามารถสร้างภาพนี้ได้ กรุณาลองใหม่", 500, err instanceof Error ? err.message : String(err));
    }
  }

  // AI_MODE=real with an AI_PROVIDER name this route doesn't have an adapter
  // for yet (spec §8 — provider must be swappable; adding a new one is a new
  // branch here, not a rewrite of anything else in the app).
  return sanitizedError(`AI Provider "${providerName}" ยังไม่รองรับในเวอร์ชันนี้`, 501);
}
