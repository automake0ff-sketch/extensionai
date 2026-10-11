import { describe, expect, it } from "vitest";
import { describeLlmNotice, findLlmHostsInCode, uncoveredLlmHosts } from "../llm-hosts";

const f = (path: string, content: string) => ({ path, content });
const manifest = (extra: object) =>
  f("manifest.json", JSON.stringify({ manifest_version: 3, name: "x", version: "1.0.0", ...extra }));

describe("findLlmHostsInCode", () => {
  it("finds LLM API hosts in js and html, deduplicated", () => {
    const hosts = findLlmHostsInCode([
      f("background.js", "fetch('https://api.openai.com/v1/chat/completions'); fetch('https://api.openai.com/v1/models');"),
      f("options.html", "<a href='https://openrouter.ai/keys'>get a key</a>"),
    ]);
    expect(hosts.sort()).toEqual(["api.openai.com", "openrouter.ai"]);
  });

  it("ignores READMEs and the manifest, and strips Ollama's port", () => {
    expect(
      findLlmHostsInCode([
        f("README.md", "Get a key at https://api.openai.com"),
        manifest({ host_permissions: ["https://api.openai.com/*"] }),
        f("popup.js", "fetch('http://localhost:11434/api/chat')"),
      ])
    ).toEqual(["localhost"]);
  });

  it("finds nothing in ordinary code", () => {
    expect(findLlmHostsInCode([f("popup.js", "fetch('https://example.com/data.json')")])).toEqual([]);
  });
});

describe("uncoveredLlmHosts", () => {
  const code = f("background.js", "fetch('https://api.anthropic.com/v1/messages')");

  it("reports a host the manifest does not declare", () => {
    expect(uncoveredLlmHosts([manifest({ permissions: ["storage"] }), code])).toEqual(["api.anthropic.com"]);
  });

  it("accepts an exact host_permissions entry, a wildcard subdomain, and <all_urls>", () => {
    for (const host_permissions of [["https://api.anthropic.com/*"], ["https://*.anthropic.com/*"], ["<all_urls>"], ["*://*/*"]]) {
      expect(uncoveredLlmHosts([manifest({ host_permissions }), code])).toEqual([]);
    }
  });

  it("accepts optional_host_permissions (endpoint granted at runtime)", () => {
    expect(uncoveredLlmHosts([manifest({ optional_host_permissions: ["https://api.anthropic.com/*"] }), code])).toEqual([]);
  });

  it("does not accept a permission for a different host", () => {
    expect(uncoveredLlmHosts([manifest({ host_permissions: ["https://api.openai.com/*"] }), code])).toEqual(["api.anthropic.com"]);
  });

  it("covers a localhost Ollama call with a port-less pattern", () => {
    const ollama = f("popup.js", "fetch('http://localhost:11434/api/chat')");
    expect(uncoveredLlmHosts([manifest({ host_permissions: ["http://localhost/*"] }), ollama])).toEqual([]);
  });

  it("reports everything when the manifest is missing or unparseable", () => {
    expect(uncoveredLlmHosts([code])).toEqual(["api.anthropic.com"]);
    expect(uncoveredLlmHosts([f("manifest.json", "{ nope"), code])).toEqual(["api.anthropic.com"]);
  });
});

describe("describeLlmNotice", () => {
  it("is empty when no AI host is used", () => {
    expect(describeLlmNotice([])).toBe("");
  });
  it("names the hosts and says an API key is needed", () => {
    const note = describeLlmNotice(["api.openai.com"]);
    expect(note).toMatch(/api\.openai\.com/);
    expect(note).toMatch(/API key/);
  });
});
