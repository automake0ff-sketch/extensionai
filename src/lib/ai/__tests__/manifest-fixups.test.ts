import { describe, expect, it } from "vitest";
import { stripMissingManifestIcons } from "../manifest-fixups";
import { validateReferencedFiles } from "../../validator/manifest";

const f = (path: string, content = "") => ({ path, content });
const manifest = (extra: object) =>
  f("manifest.json", JSON.stringify({ manifest_version: 3, name: "x", version: "1.0.0", ...extra }));

describe("stripMissingManifestIcons", () => {
  it("removes action.default_icon entries that point to missing files (the reported bug)", () => {
    const files = [
      manifest({
        action: {
          default_popup: "popup.html",
          default_icon: { "16": "icon16.png", "48": "icon48.png" },
        },
      }),
      f("popup.html"),
    ];
    const { files: out, removed } = stripMissingManifestIcons(files);
    const m = JSON.parse(out[0].content);
    expect(removed.sort()).toEqual(["icon16.png", "icon48.png"]);
    expect(m.action.default_icon).toBeUndefined();
    expect(m.action.default_popup).toBe("popup.html");
  });

  it("removes top-level icons that are missing but keeps ones that exist", () => {
    const files = [
      manifest({ icons: { "16": "icons/a.png", "128": "icons/b.png" } }),
      f("icons/a.png"),
    ];
    const { files: out, removed } = stripMissingManifestIcons(files);
    expect(removed).toEqual(["icons/b.png"]);
    expect(JSON.parse(out[0].content).icons).toEqual({ "16": "icons/a.png" });
  });

  it("handles a string default_icon and ./ prefixes", () => {
    const files = [manifest({ action: { default_icon: "./icon.png" } }), f("icon.png")];
    const { removed } = stripMissingManifestIcons(files);
    expect(removed).toEqual([]);
  });

  it("returns the input untouched when nothing is missing or the manifest is unusable", () => {
    const ok = [manifest({ action: { default_popup: "popup.html" } }), f("popup.html")];
    expect(stripMissingManifestIcons(ok).files).toBe(ok);
    const bad = [f("manifest.json", "{not json")];
    expect(stripMissingManifestIcons(bad).files).toBe(bad);
    const none = [f("popup.html")];
    expect(stripMissingManifestIcons(none).files).toBe(none);
  });
});

describe("validateReferencedFiles icons", () => {
  it("flags a missing icon as an error", () => {
    const files = [manifest({ action: { default_icon: { "16": "icon16.png" } } })].map((x) => ({
      ...x,
    })) as never;
    const issues = validateReferencedFiles(files);
    expect(issues.some((i) => i.code === "missing_referenced_file" && i.path === "icon16.png")).toBe(true);
  });
});
