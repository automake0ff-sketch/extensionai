import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { AI_FEATURES_RECIPE } from "../prompts";
import { findLlmHostsInCode, uncoveredLlmHosts } from "../../llm-hosts";
import { validateJsSyntax } from "../../validator/js-syntax";

// The recipe embeds code the Coder copies verbatim into providers.js, so a
// typo in a URL or origin ships to every generated AI extension. These tests
// pin the verified values and check the table against itself.

const tableSource = (() => {
  const start = AI_FEATURES_RECIPE.indexOf("const PROVIDERS = {");
  const end = AI_FEATURES_RECIPE.indexOf("};", start) + 2;
  return AI_FEATURES_RECIPE.slice(start, end);
})();

type Provider = { label: string; url: string; origin: string; model: string; keyUrl: string; noKey?: boolean };
const PROVIDERS = vm.runInNewContext(`${tableSource}; PROVIDERS`) as Record<string, Provider>;

describe("AI_FEATURES_RECIPE provider table", () => {
  it("is valid JavaScript", () => {
    expect(validateJsSyntax([{ path: "providers.js", content: tableSource }])).toEqual([]);
  });

  it("offers the five providers, free ones first", () => {
    expect(Object.keys(PROVIDERS)).toEqual(["groq", "gemini", "openrouter", "openai", "ollama"]);
  });

  it("uses the verified endpoint URLs", () => {
    expect(PROVIDERS.groq.url).toBe("https://api.groq.com/openai/v1/chat/completions");
    // Google's documented OpenAI-compatible path for the Gemini API.
    expect(PROVIDERS.gemini.url).toBe("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
    expect(PROVIDERS.openrouter.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(PROVIDERS.openai.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(PROVIDERS.ollama.url).toBe("http://localhost:11434/v1/chat/completions");
  });

  it("defaults OpenRouter to its free-models router, which cannot be retired like a single model", () => {
    expect(PROVIDERS.openrouter.model).toBe("openrouter/free");
  });

  it("gives every provider a label, a model and a permission origin on the same host as its URL", () => {
    for (const [name, p] of Object.entries(PROVIDERS)) {
      expect(p.label, name).toBeTruthy();
      expect(p.model, name).toBeTruthy();
      const urlHost = new URL(p.url).hostname;
      const originHost = p.origin.replace(/^https?:\/\//, "").replace(/\/\*$/, "");
      expect(originHost, name).toBe(urlHost);
    }
  });

  it("only Ollama needs no key, and everyone else links to where to get one", () => {
    for (const [name, p] of Object.entries(PROVIDERS)) {
      if (name === "ollama") expect(p.noKey).toBe(true);
      else expect(p.keyUrl, name).toMatch(/^https:\/\//);
    }
  });
});

describe("AI_FEATURES_RECIPE consistency with the validator", () => {
  it("every host in the recipe is one the validator recognizes as an AI host", () => {
    expect(findLlmHostsInCode([{ path: "providers.js", content: tableSource }]).sort()).toEqual(
      ["api.groq.com", "api.openai.com", "generativelanguage.googleapis.com", "localhost", "openrouter.ai"].sort()
    );
  });

  it("the origins it tells the Coder to declare cover every URL it uses (no false 'missing permission' warning)", () => {
    const manifest = JSON.stringify({
      manifest_version: 3,
      name: "x",
      version: "1.0.0",
      optional_host_permissions: Object.values(PROVIDERS).map((p) => p.origin),
    });
    expect(
      uncoveredLlmHosts([
        { path: "manifest.json", content: manifest },
        { path: "providers.js", content: tableSource },
      ])
    ).toEqual([]);
  });

  it("covers the moving parts: optional permissions, runtime request, importScripts, Ollama CORS hint", () => {
    for (const needle of [
      "optional_host_permissions",
      "chrome.permissions.request",
      'importScripts("providers.js")',
      "OLLAMA_ORIGINS",
      "brings their own API key",
    ]) {
      expect(AI_FEATURES_RECIPE).toContain(needle);
    }
  });
});
