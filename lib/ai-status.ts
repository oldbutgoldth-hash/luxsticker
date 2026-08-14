export interface AiStatus {
  mode: "mock" | "real";
  provider: string;
  model?: string;
  /** False when AI_MODE=real but AI_PROVIDER/AI_PROVIDER_API_KEY aren't set
   * server-side — the UI uses this to disable "Use AI Expressions" and show
   * "AI Provider ยังไม่ได้ตั้งค่า" proactively (spec §33), instead of letting
   * the user find out only after every sticker in a pack fails. */
  configured: boolean;
}

const FAIL_SAFE_STATUS: AiStatus = { mode: "mock", provider: "mock", configured: true };

/**
 * Fetches the non-secret AI configuration status from
 * app/api/generate-expression's GET handler. Never throws — a network
 * hiccup here should degrade to "assume mock, assume configured" (the
 * always-safe state) rather than surface a confusing error before the user
 * has even tried to use AI Expressions.
 */
export async function fetchAiStatus(): Promise<AiStatus> {
  try {
    const res = await fetch("/api/generate-expression", { method: "GET" });
    if (!res.ok) return FAIL_SAFE_STATUS;
    const body = (await res.json()) as Partial<AiStatus>;
    return {
      mode: body.mode === "real" ? "real" : "mock",
      provider: body.provider || "mock",
      model: body.model,
      configured: body.configured !== false,
    };
  } catch {
    return FAIL_SAFE_STATUS;
  }
}
