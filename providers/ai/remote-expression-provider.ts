import type { AIImageProvider, ExpressionGenerationInput, ExpressionGenerationResult } from "./types";
import { AIImageProviderError } from "./types";

/**
 * RemoteExpressionProvider (spec §7) — the client-side half of every "real"
 * provider. It never talks to a vendor API directly and never sees
 * `AI_PROVIDER_API_KEY` (that only exists in `process.env` on the server,
 * read inside `app/api/generate-expression/route.ts`). This class's entire
 * job is: POST the (secret-free) generation request to our own server route,
 * and translate its JSON response into the same `AIImageProvider` shape the
 * app already knows how to consume — so swapping the underlying vendor later
 * never touches the UI or the pipeline code, only the route handler.
 */
export class RemoteExpressionProvider implements AIImageProvider {
  constructor(
    public readonly name: string,
    public readonly model: string = "server-configured"
  ) {}

  async generateExpression(input: ExpressionGenerationInput): Promise<ExpressionGenerationResult> {
    let response: Response;
    try {
      response = await fetch("/api/generate-expression", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
    } catch {
      throw new AIImageProviderError("เครือข่ายขัดข้อง ไม่สามารถติดต่อ AI Provider ได้ ลองใหม่อีกครั้ง", this.name);
    }

    if (!response.ok) {
      let message = `AI สร้างภาพไม่สำเร็จ (${response.status})`;
      try {
        const body = (await response.json()) as { error?: string };
        if (body?.error) message = body.error;
      } catch {
        // response wasn't JSON — keep the generic status-based message.
      }
      throw new AIImageProviderError(message, this.name);
    }

    const result = (await response.json()) as ExpressionGenerationResult;
    return result;
  }
}
