import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenRouterProvider } from "../openrouter";

describe("OpenRouterProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses a successful completion response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: "meta-llama/llama-3.3-70b-instruct:free",
        choices: [{ message: { content: '{"hello":"world"}' } }],
        usage: { prompt_tokens: 120, completion_tokens: 30 },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const provider = new OpenRouterProvider("test-key");
    const result = await provider.complete({ system: "You are a test.", messages: [{ role: "user", content: "hi" }] });

    expect(result.text).toBe('{"hello":"world"}');
    expect(result.tokensUsed).toBe(150);
    expect(result.model).toBe("meta-llama/llama-3.3-70b-instruct:free");

    // Confirms the system prompt and messages are sent in OpenAI-compatible shape.
    const [, init] = mockFetch.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.messages[0]).toEqual({ role: "system", content: "You are a test." });
    expect(body.messages[1]).toEqual({ role: "user", content: "hi" });
    expect(init.headers.Authorization).toBe("Bearer test-key");
  });

  it("throws a descriptive error on a non-OK response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 402,
        text: async () => '{"error":"insufficient credits"}',
      })
    );

    const provider = new OpenRouterProvider("test-key");
    await expect(provider.complete({ system: "s", messages: [] })).rejects.toThrow(/402/);
  });

  it("handles a missing usage field without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "ok" } }] }),
      })
    );

    const provider = new OpenRouterProvider("test-key");
    const result = await provider.complete({ system: "s", messages: [] });
    expect(result.tokensUsed).toBe(0);
    expect(result.text).toBe("ok");
  });
});
