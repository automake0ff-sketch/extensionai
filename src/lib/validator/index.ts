import type { ProjectFile, ValidationResult } from "@/lib/types";
import { scanFileForSecurityIssues, validateManifest, validateReferencedFiles } from "./manifest";

/**
 * Full "Extension health" check (spec section 15). Runs before ZIP export
 * and can also be triggered manually from the editor.
 */
export function validateProject(files: ProjectFile[]): ValidationResult {
  const manifestFile = files.find((f) => f.path === "manifest.json");

  const issues = [
    ...(manifestFile ? validateManifest(manifestFile.content) : [
      { level: "error" as const, code: "manifest_missing", message: "Project has no manifest.json." },
    ]),
    ...validateReferencedFiles(files),
    ...files.flatMap((f) => scanFileForSecurityIssues(f)),
  ];

  const valid = !issues.some((issue) => issue.level === "error");
  return { valid, issues };
}
