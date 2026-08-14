import type { AIImageProvider, ExpressionGenerationInput, ExpressionGenerationResult } from "./types";
import { AIImageProviderError } from "./types";

/**
 * Resolves a browser-only `blob:` (or `http(s):`) object URL into a
 * self-contained `data:` URL (base64).
 *
 * This matters for Phase 3 specifically: `characterReference.cutoutUrl` is
 * almost always a `blob:` object URL created by `URL.createObjectURL()`
 * (background removal, Character Master, etc.) — those URLs are only ever
 * valid inside the browser tab that created them. POSTing one to our own
 * Next.js server as a plain string would be silently useless: the server
 * process has no such blob and can't fetch it, so a "real" vendor call could
 * never actually receive the reference image. Converting to a `data:` URL
 * here means the request body is a genuinely self-contained image the
 * server (and, from there, a real AI provider's upload) can decode.
 */
async function toDataUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) return url; // already inline (e.g. MockExpressionProvider's own output)
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("อ่านไฟล์ภาพอ้างอิงไม่สำเร็จ"));
    reader.readAsDataURL(blob);
  });
}

/**
 * RemoteExpressionProvider (spec §7) — the client-side half of every "real"
 * provider. It never talks to a vendor API directly and never sees
 * `AI_PROVIDER_API_KEY` (that only exists in `process.env` on the server,
 * read inside `app/api/generate-expression/route.ts`). This class's entire
 * job is: resolve the character reference to real, self-contained image
 * bytes, POST the (secret-free) generation request to our own server route,
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
    let requestInput: ExpressionGenerationInput;
    try {
      const cutoutDataUrl = await toDataUrl(input.characterReference.cutoutUrl);
      requestInput = { ...input, characterReference: { ...input.characterReference, cutoutUrl: cutoutDataUrl } };
    } catch {
      throw new AIImageProviderError("ไม่สามารถเตรียมภาพอ้างอิงตัวละครสำหรับ AI ได้ ลองใหม่อีกครั้ง", this.name);
    }

    let response: Response;
    try {
      response = await fetch("/api/generate-expression", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestInput),
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
