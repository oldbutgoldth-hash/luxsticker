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

/**
 * Resolves which provider the CLIENT should ask for. `NEXT_PUBLIC_AI_PROVIDER`
 * is intentionally a separate, non-secret env var from the server-only
 * `AI_PROVIDER` — it exists purely so the UI can show "DEVELOPMENT MODE /
 * MOCK AI" banners correctly (spec §25) without ever needing a secret on the
 * client. If unset, defaults to "mock" — the safe, zero-cost default (spec
 * §24: "Default: OFF ใน Development").
 */
export function resolveClientProviderName(): string {
  return process.env.NEXT_PUBLIC_AI_PROVIDER?.trim() || "mock";
}

export function isMockProvider(name: string): boolean {
  return name === "mock";
}
