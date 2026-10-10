import { describe, expect, it } from "vitest";
import { validateProject } from "../index";
import { validateManifest } from "../manifest";

const f = (path: string, content: string) => ({
  id: path,
  project_id: "p1",
  path,
  content,
  created_at: "",
  updated_at: "",
});

const manifest = (extra: object) =>
  JSON.stringify({ manifest_version: 3, name: "x", version: "1.0.0", ...extra });

describe("known permissions", () => {
  it("recognizes the permissions an MV3 site blocker or side panel needs", () => {
    const issues = validateManifest(
      manifest({ permissions: ["declarativeNetRequest", "sidePanel", "storage", "alarms", "offscreen"] })
    );
    expect(issues.filter((i) => i.code === "unknown_permission")).toEqual([]);
  });

  it("still flags a made-up permission", () => {
    const issues = validateManifest(manifest({ permissions: ["superTabs"] }));
    expect(issues.some((i) => i.code === "unknown_permission")).toBe(true);
  });
});

describe("string timers", () => {
  it("flags setTimeout/setInterval called with a string as an error", () => {
    for (const code of ['setTimeout("doIt()", 100);', "setInterval('tick()', 1000);", "setTimeout(`go()`, 5);"]) {
      const result = validateProject([
        f("manifest.json", manifest({})),
        f("background.js", code),
      ]);
      expect(result.issues.some((i) => i.code === "string_timer_usage" && i.level === "error")).toBe(true);
    }
  });

  it("allows timers given a function", () => {
    const result = validateProject([
      f("manifest.json", manifest({})),
      f("background.js", "setTimeout(() => run(), 100); setTimeout(function () { run(); }, 5); setInterval(tick, 1000);"),
    ]);
    expect(result.issues.some((i) => i.code === "string_timer_usage")).toBe(false);
  });
});

describe("pages referenced from the manifest must exist", () => {
  it("flags a missing side panel page", () => {
    const result = validateProject([
      f("manifest.json", manifest({ side_panel: { default_path: "sidepanel.html" }, permissions: ["sidePanel"] })),
    ]);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "missing_referenced_file" && i.path === "sidepanel.html")).toBe(true);
  });

  it("flags a missing options_ui page", () => {
    const result = validateProject([
      f("manifest.json", manifest({ options_ui: { page: "options.html" } })),
    ]);
    expect(result.issues.some((i) => i.code === "missing_referenced_file" && i.path === "options.html")).toBe(true);
  });

  it("accepts them when the files exist", () => {
    const result = validateProject([
      f("manifest.json", manifest({ side_panel: { default_path: "sidepanel.html" }, options_ui: { page: "options.html" }, permissions: ["sidePanel"] })),
      f("sidepanel.html", "<p>panel</p>"),
      f("options.html", "<p>options</p>"),
    ]);
    expect(result.issues.filter((i) => i.code === "missing_referenced_file")).toEqual([]);
  });
});
