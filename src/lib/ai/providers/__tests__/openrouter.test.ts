import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_OPENROUTER_MODEL, FALLBACK_FREE_MODELS, OpenRouterProvider } from "../openrouter";

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

  it("falls back to the next free model when one has been retired", async () => {
    const retiredBody =
      '{"error":{"message":"This model is unavailable for free. The paid version is available now - use this slug instead: qwen/qwen3-coder","code":404}}';
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404, text: async () => retiredBody })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: FALLBACK_FREE_MODELS[1],
          choices: [{ message: { content: "recovered" } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      });
    vi.stubGlobal("fetch", mockFetch);

    const provider = new OpenRouterProvider("test-key", "qwen/qwen3-coder:free");
    const result = await provider.complete({ system: "s", messages: [] });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).model).toBe("qwen/qwen3-coder:free");
    expect(JSON.parse(mockFetch.mock.calls[1][1].body).model).toBe(FALLBACK_FREE_MODELS[0]);
    expect(result.text).toBe("recovered");
  });

  it("does not fall back, and reports the real error, on a non-retirement failure", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      text: async () => '{"error":"insufficient credits"}',
    });
    vi.stubGlobal("fetch", mockFetch);

    const provider = new OpenRouterProvider("test-key", "qwen/qwen3-coder:free");
    await expect(provider.complete({ system: "s", messages: [] })).rejects.toThrow(/402/);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("throws the last retirement error if every fallback candidate is also retired", async () => {
    const retiredBody = '{"error":{"message":"This model is unavailable for free.","code":404}}';
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => retiredBody })
    );

    const provider = new OpenRouterProvider("test-key", "qwen/qwen3-coder:free");
    await expect(provider.complete({ system: "s", messages: [] })).rejects.toThrow(/404/);
  });

  it("rotates to the next API key when the first is rate-limited (429)", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429, text: async () => '{"error":"rate limited"}' })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: DEFAULT_OPENROUTER_MODEL,
          choices: [{ message: { content: "from key 2" } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }),
      });
    vi.stubGlobal("fetch", mockFetch);

    const provider = new OpenRouterProvider(["key-one", "key-two"]);
    const result = await provider.complete({ system: "s", messages: [] });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe("Bearer key-one");
    expect(mockFetch.mock.calls[1][1].headers.Authorization).toBe("Bearer key-two");
    // Rotating keys restarts from the configured model, not wherever the
    // previous key's model loop left off.
    expect(JSON.parse(mockFetch.mock.calls[1][1].body).model).toBe(DEFAULT_OPENROUTER_MODEL);
    expect(result.text).toBe("from key 2");
  });

  it("rotates keys on 402 (out of credits) and on 401 (invalid key) too", async () => {
    for (const status of [401, 402]) {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status, text: async () => "{}" })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ choices: [{ message: { content: "ok" } }] }),
        });
      vi.stubGlobal("fetch", mockFetch);

      const provider = new OpenRouterProvider(["key-one", "key-two"]);
      const result = await provider.complete({ system: "s", messages: [] });
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.text).toBe("ok");
      vi.unstubAllGlobals();
    }
  });

  it("throws once every key is exhausted, reporting the last key's error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 429, text: async () => '{"error":"rate limited"}' })
    );

    const provider = new OpenRouterProvider(["key-one", "key-two"]);
    await expect(provider.complete({ system: "s", messages: [] })).rejects.toThrow(/429/);
  });

  it("ignores blank entries and trims whitespace when given a key array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "ok" } }] }),
      })
    );
    const provider = new OpenRouterProvider([" key-one ", "", "  "]);
    await provider.complete({ system: "s", messages: [] });
    const mockFetch = vi.mocked(fetch);
    expect(mockFetch.mock.calls[0][1]!.headers!["Authorization" as never]).toBe("Bearer key-one");
  });

  it("throws if constructed with no usable keys", () => {
    expect(() => new OpenRouterProvider([" ", ""])).toThrow(/at least one API key/);
  });
});
