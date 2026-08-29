import { describe, expect, it } from "vitest";
import { validateProject } from "../index";
import type { ProjectFile } from "@/lib/types";

function file(path: string, content: string): ProjectFile {
  return {
    id: path,
    project_id: "p1",
    path,
    content,
    created_at: "",
    updated_at: "",
  };
}

const VALID_MANIFEST = JSON.stringify({
  manifest_version: 3,
  name: "Test Extension",
  version: "1.0.0",
  description: "A test extension.",
  permissions: ["storage"],
  action: { default_popup: "popup.html" },
});

describe("validateProject", () => {
  it("passes a minimal, correct extension", () => {
    const files = [
      file("manifest.json", VALID_MANIFEST),
      file("popup.html", "<html><body>Hi</body></html>"),
    ];
    const result = validateProject(files);
    expect(result.valid).toBe(true);
    expect(result.issues.filter((i) => i.level === "error")).toHaveLength(0);
  });

  it("flags a missing manifest.json", () => {
    const result = validateProject([file("popup.html", "<html></html>")]);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "manifest_missing")).toBe(true);
  });

  it("flags manifest_version other than 3", () => {
    const manifest = JSON.stringify({ manifest_version: 2, name: "X", version: "1.0.0" });
    const result = validateProject([file("manifest.json", manifest)]);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "manifest_version")).toBe(true);
  });

  it("flags invalid JSON in manifest.json", () => {
    const result = validateProject([file("manifest.json", "{ not json")]);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "manifest_invalid_json")).toBe(true);
  });

  it("flags a missing file referenced from the manifest", () => {
    const manifest = JSON.stringify({
      manifest_version: 3,
      name: "X",
      version: "1.0.0",
      action: { default_popup: "popup.html" },
    });
    const result = validateProject([file("manifest.json", manifest)]);
    expect(result.issues.some((i) => i.code === "missing_referenced_file")).toBe(true);
  });

  it("flags eval() usage as an error", () => {
    const files = [file("manifest.json", VALID_MANIFEST), file("popup.js", "eval('2+2')")];
    const result = validateProject(files);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "eval_usage")).toBe(true);
  });

  it("flags hardcoded secrets", () => {
    const files = [
      file("manifest.json", VALID_MANIFEST),
      file("background.js", 'const apiKey = "sk-abcdef1234567890";'),
    ];
    const result = validateProject(files);
    expect(result.issues.some((i) => i.code === "hardcoded_secret")).toBe(true);
  });

  it("warns on <all_urls> host permission", () => {
    const manifest = JSON.stringify({
      manifest_version: 3,
      name: "X",
      version: "1.0.0",
      host_permissions: ["<all_urls>"],
    });
    const result = validateProject([file("manifest.json", manifest)]);
    const warning = result.issues.find((i) => i.code === "broad_host_permission");
    expect(warning?.level).toBe("warning");
  });
});
