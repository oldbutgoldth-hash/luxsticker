import { NextResponse } from "next/server";
import type { ExpressionGenerationInput, ExpressionGenerationResult } from "@/providers/ai/types";

// ============================================================================
// Server-side AI Expression route (spec §7). This is the ONLY place in the
// whole app allowed to read `AI_PROVIDER_API_KEY` — it is a plain server
// environment variable (never `NEXT_PUBLIC_AI_PROVIDER_API_KEY`), so Next.js
// never bundles it into any client JS. The client's RemoteExpressionProvider
// (providers/ai/remote-expression-provider.ts) only ever sees this route's
// JSON response, never the key itself, never even its presence/absence in a
// way that reveals the value (spec §28: no API key in client, LocalStorage,
// IndexedDB, ZIP, BUILD_INFO.txt, or console).
// ============================================================================

export async function POST(request: Request) {
  let input: ExpressionGenerationInput;
  try {
    input = (await request.json()) as ExpressionGenerationInput;
  } catch {
    return NextResponse.json({ error: "คำขอไม่ถูกต้อง (invalid JSON body)" }, { status: 400 });
  }

  const providerName = process.env.AI_PROVIDER?.trim() || "mock";
  const apiKey = process.env.AI_PROVIDER_API_KEY;

  if (providerName === "mock") {
    // Best-effort server-side mirror of MockExpressionProvider, for direct
    // route testing only. The live app never actually reaches this branch —
    // the client resolves "mock" to providers/ai/mock-expression-provider.ts
    // directly and never calls this route at all, specifically because a
    // browser `blob:`/object URL (what `characterReference.cutoutUrl`
    // usually is) cannot be fetched from this server process. This branch
    // exists only so the route itself has defined, honest behavior for
    // AI_PROVIDER=mock rather than silently 500-ing if it's ever hit.
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

  if (!apiKey) {
    // Deliberately vague: confirms nothing about which vendor is/isn't
    // configured beyond "not ready yet" — never echoes env var names/values.
    return NextResponse.json(
      { error: "ยังไม่ได้ตั้งค่า AI Provider สำหรับการใช้งานจริง กรุณาติดต่อผู้ดูแลระบบ" },
      { status: 501 }
    );
  }

  // Phase 2.5 ships the full plumbing (interface, registry, prompt builder,
  // cache, this route, env handling) but deliberately does NOT wire up a
  // specific real vendor yet (spec §7: "อย่าเพิ่ง hard-code API Key" — the
  // point of this phase is the abstraction, not picking a vendor). Swapping
  // in a real call means adding one vendor-specific branch here; nothing
  // else in the app changes.
  console.error(`[generate-expression] provider "${providerName}" has an API key configured but no vendor integration is implemented yet.`);
  return NextResponse.json(
    { error: `AI Provider "${providerName}" ยังไม่ได้เชื่อมต่อจริงในเวอร์ชันนี้` },
    { status: 501 }
  );
}
