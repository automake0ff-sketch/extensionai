import { describe, expect, it } from "vitest";
import { validateProject } from "../index";

const f = (path: string, content: string) => ({
  id: path, project_id: "p1", path, content, created_at: "", updated_at: "",
});
const manifest = (extra: object) =>
  JSON.stringify({ manifest_version: 3, name: "x", version: "1.0.0", permissions: ["storage"], ...extra });
const code = f("background.js", "fetch('https://api.openai.com/v1/chat/completions', { method: 'POST' });");

describe("LLM host permission check in validateProject", () => {
  it("warns (never errors) when the API host is not declared", () => {
    const result = validateProject([f("manifest.json", manifest({ background: { service_worker: "background.js" } })), code]);
    const issue = result.issues.find((i) => i.code === "llm_host_permission_missing");
    expect(issue).toMatchObject({ level: "warning", path: "manifest.json" });
    expect(issue!.message).toMatch(/api\.openai\.com/);
    expect(result.valid).toBe(true); // a warning must not block export
  });

  it("is silent once the host is declared", () => {
    const result = validateProject([
      f("manifest.json", manifest({ background: { service_worker: "background.js" }, host_permissions: ["https://api.openai.com/*"] })),
      code,
    ]);
    expect(result.issues.some((i) => i.code === "llm_host_permission_missing")).toBe(false);
  });
});
