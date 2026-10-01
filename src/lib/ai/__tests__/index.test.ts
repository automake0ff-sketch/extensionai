import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("getAiProvider", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("splits a comma-separated AI_API_KEY into multiple openrouter keys", async () => {
    process.env.AI_PROVIDER = "openrouter";
    process.env.AI_API_KEY = " key-one , key-two ,,key-three";

    const { getAiProvider } = await import("../index");
    const { OpenRouterProvider } = await import("../providers/openrouter");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "ok" } }] }),
      })
    );

    const provider = getAiProvider();
    expect(provider).toBeInstanceOf(OpenRouterProvider);
    await provider.complete({ system: "s", messages: [] });

    const mockFetch = vi.mocked(fetch);
    expect(mockFetch.mock.calls[0][1]!.headers!["Authorization" as never]).toBe("Bearer key-one");
    vi.unstubAllGlobals();
  });

  it("uses only the first key for the anthropic provider even if several are given", async () => {
    process.env.AI_PROVIDER = "anthropic";
    process.env.AI_API_KEY = "anthropic-key-one,anthropic-key-two";

    const { getAiProvider } = await import("../index");
    const { AnthropicProvider } = await import("../providers/anthropic");

    expect(getAiProvider()).toBeInstanceOf(AnthropicProvider);
  });

  it("throws a clear error when AI_API_KEY is unset or blank", async () => {
    process.env.AI_PROVIDER = "openrouter";
    process.env.AI_API_KEY = "  ,  ,";

    const { getAiProvider } = await import("../index");
    expect(() => getAiProvider()).toThrow(/AI_API_KEY is not set/);
  });
});
