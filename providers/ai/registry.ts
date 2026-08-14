import type { AIImageProvider } from "./types";
import { mockExpressionProvider } from "./mock-expression-provider";
import { RemoteExpressionProvider } from "./remote-expression-provider";

/**
 * Provider registry (spec §4/§8) — the ONE place that decides which
 * AIImageProvider implementation to use. Nothing else in the app
 * `new MockExpressionProvider()`s or imports a vendor SDK directly; the UI
 * and the pipeline both call `getAIImageProvider(name)` and program against
 * the `AIImageProvider` interface only. This keeps "swap the provider" a
 * one-line config change (spec §8: `AI_PROVIDER=mock` today,
 * `AI_PROVIDER=provider-a` / `AI_PROVIDER=provider-b` later) instead of a
 * code change scattered across components.
 *
 * `name` is expected to come from `resolveClientProviderName()` below (client
 * components) — never read `process.env.AI_PROVIDER_API_KEY` here or
 * anywhere else outside `app/api/generate-expression/route.ts` (spec §28).
 */
export function getAIImageProvider(name: string): AIImageProvider {
  if (name === "mock") return mockExpressionProvider;
  // Any non-mock name is treated as "a real provider, configured server-side"
  // — the client never knows or cares which vendor it actually is. The
  // server route (`AI_PROVIDER` + `AI_PROVIDER_API_KEY`, server-only env)
  // decides that.
  return new RemoteExpressionProvider(name);
}

export type AiMode = "mock" | "real";

/**
 * Resolves the master AI_MODE switch (spec Phase 3 §31) — distinct from
 * *which* real vendor (`AI_PROVIDER`). `NEXT_PUBLIC_AI_MODE` is the client-
 * visible, non-secret mirror of the server's `AI_MODE`; anything other than
 * the literal string "real" is treated as "mock", so a missing/typo'd env
 * var fails safe into the zero-cost mock path rather than silently trying
 * (and failing) to reach a real vendor (spec §31: "Default Development: mock").
 */
export function resolveClientAiMode(): AiMode {
  return process.env.NEXT_PUBLIC_AI_MODE?.trim().toLowerCase() === "real" ? "real" : "mock";
}

/**
 * Resolves which provider the CLIENT should ask for. `NEXT_PUBLIC_AI_PROVIDER`
 * is intentionally a separate, non-secret env var from the server-only
 * `AI_PROVIDER` — it exists purely so the UI can show "DEVELOPMENT MODE /
 * MOCK AI" banners correctly (spec §25) without ever needing a secret on the
 * client. Only consulted when `resolveClientAiMode()` is "real" — AI_MODE is
 * the master switch, so a "real" provider name with AI_MODE left at "mock"
 * still resolves to mock (spec §31/§34: never accidentally use a real
 * provider, and never claim mock is real).
 */
export function resolveClientProviderName(): string {
  if (resolveClientAiMode() !== "real") return "mock";
  return process.env.NEXT_PUBLIC_AI_PROVIDER?.trim() || "mock";
}

export function isMockProvider(name: string): boolean {
  return name === "mock";
}
