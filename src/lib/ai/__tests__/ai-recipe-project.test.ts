import { describe, expect, it } from "vitest";
import { AI_FEATURES_RECIPE } from "../prompts";
import { validateProject } from "../../validator";
import { validateJsSyntax } from "../../validator/js-syntax";
import { findLlmHostsInCode } from "../../llm-hosts";

// A project laid out exactly as the recipe instructs. If the recipe and the
// validator ever disagree (a rule that flags what the recipe tells the Coder
// to write), this fails before users see a false error on a correct extension.

const tableSource = AI_FEATURES_RECIPE.slice(
  AI_FEATURES_RECIPE.indexOf("const PROVIDERS = {"),
  AI_FEATURES_RECIPE.indexOf("};", AI_FEATURES_RECIPE.indexOf("const PROVIDERS = {")) + 2
);
const origins = [...tableSource.matchAll(/origin: "([^"]+)"/g)].map((m) => m[1]);

const file = (path: string, content: string) => ({
  id: path, project_id: "p1", path, content, created_at: "", updated_at: "",
});

const project = [
  file(
    "manifest.json",
    JSON.stringify({
      manifest_version: 3,
      name: "Quiz Generator",
      version: "1.0.0",
      description: "Generates a multiple-choice quiz from pasted text.",
      permissions: ["storage"],
      optional_host_permissions: origins,
      background: { service_worker: "background.js" },
      options_ui: { page: "options.html" },
      action: { default_popup: "popup.html" },
    })
  ),
  file("providers.js", tableSource),
  file(
    "background.js",
    `importScripts("providers.js");
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== "ask") return;
  (async () => {
    const { provider, apiKey, model } = await chrome.storage.local.get(["provider", "apiKey", "model"]);
    const p = PROVIDERS[provider];
    if (!p || (!apiKey && !p.noKey)) { sendResponse({ error: "missing_key" }); return; }
    try {
      const headers = { "Content-Type": "application/json" };
      if (!p.noKey) headers.Authorization = "Bearer " + apiKey;
      const res = await fetch(p.url, {
        method: "POST",
        headers,
        body: JSON.stringify({ model: model || p.model, messages: [{ role: "system", content: msg.task }, { role: "user", content: msg.text }] }),
      });
      if (!res.ok) { sendResponse({ error: "http_" + res.status }); return; }
      const data = await res.json();
      sendResponse({ text: data.choices[0].message.content });
    } catch (e) {
      sendResponse({ error: "network" });
    }
  })();
  return true;
});`
  ),
  file(
    "options.html",
    `<!doctype html><html><body>
<select id="provider"></select>
<input id="apiKey" type="password">
<input id="model">
<button id="save">Save</button>
<p>Stored on this device, not encrypted. Use a key with a spending limit.</p>
<script src="providers.js"></script>
<script src="options.js"></script>
</body></html>`
  ),
  file(
    "options.js",
    `const select = document.getElementById("provider");
for (const [id, p] of Object.entries(PROVIDERS)) {
  const o = document.createElement("option");
  o.value = id;
  o.textContent = p.label;
  select.appendChild(o);
}
document.getElementById("save").addEventListener("click", async () => {
  const provider = select.value;
  const granted = await chrome.permissions.request({ origins: [PROVIDERS[provider].origin] });
  if (!granted) return;
  await chrome.storage.local.set({
    provider,
    apiKey: document.getElementById("apiKey").value,
    model: document.getElementById("model").value || PROVIDERS[provider].model,
  });
});`
  ),
  file(
    "popup.html",
    `<!doctype html><html><body><h1>Quiz</h1><textarea id="text"></textarea>
<button id="go">Generate quiz</button><pre id="out"></pre>
<p id="privacy">The text is sent to your provider with your API key.</p>
<script src="popup.js"></script></body></html>`
  ),
  file(
    "popup.js",
    `document.getElementById("go").addEventListener("click", async () => {
  const out = document.getElementById("out");
  out.textContent = "Working...";
  try {
    const reply = await chrome.runtime.sendMessage({ action: "ask", task: "Write a quiz", text: document.getElementById("text").value });
    out.textContent = reply && reply.text ? reply.text : "Check your settings.";
  } catch (e) {
    out.textContent = "Could not reach the extension worker.";
  }
});`
  ),
];

describe("a project built exactly as the AI recipe describes", () => {
  it("passes the validator with no errors", () => {
    const result = validateProject(project);
    expect(result.issues.filter((i) => i.level === "error")).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("raises none of the AI-specific warnings either", () => {
    const codes = validateProject(project).issues.map((i) => i.code);
    expect(codes).not.toContain("llm_host_permission_missing");
    expect(codes).not.toContain("inner_html_dynamic");
    expect(codes).not.toContain("hardcoded_secret");
  });

  it("every script parses as JavaScript", () => {
    expect(validateJsSyntax(project)).toEqual([]);
  });

  it("is recognized as using five AI providers, which drives the chat notice", () => {
    expect(findLlmHostsInCode(project)).toHaveLength(5);
  });
});
