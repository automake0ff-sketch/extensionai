import type { ValidationIssue, ValidationResult } from "@/lib/types";
import { scanFileForSecurityIssues, validateManifest, validateReferencedFiles, type FileLike } from "./manifest";
import { validateJsSyntax } from "./js-syntax";
import { validateInnerHtmlUsage, validateLlmHostPermissions, validateWebAccessibleResources } from "./practices";

/**
 * Full "Extension health" check (spec section 15). Runs before ZIP export
 * and can also be triggered manually from the editor.
 */
export function validateProject(files: FileLike[]): ValidationResult {
  const manifestFile = files.find((f) => f.path === "manifest.json");

  const issues = [
    ...(manifestFile ? validateManifest(manifestFile.content) : [
      { level: "error" as const, code: "manifest_missing", message: "Project has no manifest.json." },
    ]),
    ...validateReferencedFiles(files),
    ...files.flatMap((f) => scanFileForSecurityIssues(f)),
    ...validateJsSyntax(files),
    ...validateInnerHtmlUsage(files),
    ...validateWebAccessibleResources(files),
    ...validateLlmHostPermissions(files),
  ];

  const valid = !issues.some((issue) => issue.level === "error");
  return { valid, issues };
}

/**
 * Errors that would stop a generated project from loading in Chrome or from
 * being exported, used to make the Coder retry before the user ever sees the
 * result. hardcoded_secret is left out on purpose: its pattern also matches
 * harmless placeholders (a settings page's example key), and retrying three
 * times over a placeholder would fail generations that are fine.
 */
export function findBlockingIssues(files: FileLike[]): ValidationIssue[] {
  return validateProject(files).issues.filter((i) => i.level === "error" && i.code !== "hardcoded_secret");
}
