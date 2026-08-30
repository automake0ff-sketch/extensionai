import { describe, expect, it } from "vitest";
import {
  assertChangesWithinProjectLimits,
  assertWithinProjectLimits,
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_PROJECT,
  ProjectLimitError,
} from "../limits";
import type { ProjectFile } from "@/lib/types";

function file(path: string, content: string): ProjectFile {
  return { id: path, project_id: "p1", path, content, created_at: "", updated_at: "" };
}

describe("assertWithinProjectLimits", () => {
  it("allows a small, normal project", () => {
    expect(() =>
      assertWithinProjectLimits([
        { path: "manifest.json", content: "{}" },
        { path: "popup.html", content: "<html></html>" },
      ])
    ).not.toThrow();
  });

  it("rejects too many files", () => {
    const files = Array.from({ length: MAX_FILES_PER_PROJECT + 1 }, (_, i) => ({
      path: `file-${i}.js`,
      content: "x",
    }));
    expect(() => assertWithinProjectLimits(files)).toThrow(ProjectLimitError);
  });

  it("rejects a single file over the per-file limit", () => {
    const files = [{ path: "big.js", content: "x".repeat(MAX_FILE_SIZE_BYTES + 1) }];
    expect(() => assertWithinProjectLimits(files)).toThrow(ProjectLimitError);
  });

  it("rejects a project whose total size exceeds the limit even if no single file does", () => {
    const chunk = "x".repeat(MAX_FILE_SIZE_BYTES - 1024);
    const files = Array.from({ length: 12 }, (_, i) => ({ path: `file-${i}.js`, content: chunk }));
    expect(() => assertWithinProjectLimits(files)).toThrow(ProjectLimitError);
  });
});

describe("assertChangesWithinProjectLimits", () => {
  it("allows a small update", () => {
    const current = [file("manifest.json", "{}")];
    expect(() =>
      assertChangesWithinProjectLimits(current, [{ path: "manifest.json", action: "update", content: "{ }" }])
    ).not.toThrow();
  });

  it("counts a deleted file as removed from the total", () => {
    const current = [
      file("manifest.json", "{}"),
      file("big.js", "x".repeat(MAX_FILE_SIZE_BYTES - 1)),
    ];
    expect(() =>
      assertChangesWithinProjectLimits(current, [{ path: "big.js", action: "delete" }])
    ).not.toThrow();
  });

  it("rejects a proposed update that pushes a file over the per-file limit", () => {
    const current = [file("manifest.json", "{}")];
    expect(() =>
      assertChangesWithinProjectLimits(current, [
        { path: "manifest.json", action: "update", content: "x".repeat(MAX_FILE_SIZE_BYTES + 1) },
      ])
    ).toThrow(ProjectLimitError);
  });

  it("rejects a proposed create that pushes the file count over the limit", () => {
    const current = Array.from({ length: MAX_FILES_PER_PROJECT }, (_, i) => file(`file-${i}.js`, "x"));
    expect(() =>
      assertChangesWithinProjectLimits(current, [{ path: "one-more.js", action: "create", content: "x" }])
    ).toThrow(ProjectLimitError);
  });
});
