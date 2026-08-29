import { describe, expect, it } from "vitest";
import { slugifyFilename, buildExtensionZip } from "../build";
import JSZip from "jszip";
import type { ProjectFile } from "@/lib/types";

describe("slugifyFilename", () => {
  it("lowercases and hyphenates", () => {
    expect(slugifyFilename("Amazon Price Exporter")).toBe("amazon-price-exporter");
  });

  it("strips punctuation", () => {
    expect(slugifyFilename("My Cool Extension! (v2)")).toBe("my-cool-extension-v2");
  });

  it("falls back for empty input", () => {
    expect(slugifyFilename("   ")).toBe("extension");
  });
});

describe("buildExtensionZip", () => {
  it("includes every project file and adds a README when missing", async () => {
    const files: ProjectFile[] = [
      { id: "1", project_id: "p", path: "manifest.json", content: "{}", created_at: "", updated_at: "" },
      { id: "2", project_id: "p", path: "src/popup.js", content: "console.log(1)", created_at: "", updated_at: "" },
    ];
    const buffer = await buildExtensionZip("My Extension", files);
    const zip = await JSZip.loadAsync(buffer);
    expect(Object.keys(zip.files).sort()).toEqual(
      ["README.md", "manifest.json", "src/", "src/popup.js"].sort()
    );
  });

  it("does not overwrite an existing README.md", async () => {
    const files: ProjectFile[] = [
      { id: "1", project_id: "p", path: "manifest.json", content: "{}", created_at: "", updated_at: "" },
      { id: "2", project_id: "p", path: "README.md", content: "custom readme", created_at: "", updated_at: "" },
    ];
    const buffer = await buildExtensionZip("My Extension", files);
    const zip = await JSZip.loadAsync(buffer);
    const content = await zip.file("README.md")!.async("string");
    expect(content).toBe("custom readme");
  });
});
