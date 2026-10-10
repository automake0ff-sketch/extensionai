import type { ValidationIssue } from "@/lib/types";

type FileLike = { path: string; content: string };

/**
 * Best-practice checks that are warnings, not errors: each one flags code
 * that is *often* a problem but can be legitimate, so none of them should
 * block an export or force the AI to regenerate.
 */

/**
 * Flags `el.innerHTML = <concatenation or template interpolation>`.
 * Deliberately narrow, and deliberately a warning:
 *  - Plain string literals are fine (static markup).
 *  - Anything routed through an escape/sanitize helper on the same line is
 *    fine -- generated code commonly does `'<p>' + escapeHtml(x) + '</p>'`
 *    correctly, and flagging that would just train people to ignore warnings.
 *  - A bare identifier (`el.innerHTML = html`) can't be judged by a
 *    line-level check, so it is not flagged. This catches the obvious
 *    unescaped-interpolation case, not every possible XSS.
 */
export function validateInnerHtmlUsage(files: FileLike[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const file of files) {
    if (!file.path.endsWith(".js")) continue;

    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/\.innerHTML\s*\+?=\s*(.+)$/);
      if (!match) continue;

      const rhs = match[1].trim();
      const dynamic = /\$\{/.test(rhs) || /["'`]\s*\+|\+\s*["'`A-Za-z_$]/.test(rhs);
      const handled = /escape|sanitiz|DOMPurify|textContent/i.test(rhs);
      if (dynamic && !handled) {
        issues.push({
          level: "warning",
          code: "inner_html_dynamic",
          message: `${file.path} (line ${i + 1}) assigns concatenated or interpolated content to innerHTML. If any part comes from the page or the user, use textContent or escape it first.`,
          path: file.path,
        });
        break; // one warning per file is enough
      }
    }
  }

  return issues;
}

const globToRegExp = (glob: string): RegExp =>
  new RegExp(
    "^" +
      glob
        .replace(/^\.?\//, "")
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*") +
      "$"
  );

/**
 * A content script that loads an extension file into the page (an image,
 * stylesheet, iframe, fetch...) via chrome.runtime.getURL() only works if
 * that file is listed in manifest.json "web_accessible_resources"; otherwise
 * the page gets a blocked/404 request and the extension looks half broken
 * even though it loads fine. Only content scripts are checked: extension
 * pages (popup, options, side panel) can load their own files freely.
 */
export function validateWebAccessibleResources(files: FileLike[]): ValidationIssue[] {
  const manifestFile = files.find((f) => f.path === "manifest.json");
  if (!manifestFile) return [];

  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(manifestFile.content);
  } catch {
    return []; // already reported by validateManifest
  }

  const contentScripts = Array.isArray(manifest.content_scripts)
    ? (manifest.content_scripts as { js?: string[] }[])
    : [];
  const contentScriptPaths = new Set(contentScripts.flatMap((cs) => cs.js ?? []));
  if (contentScriptPaths.size === 0) return [];

  const declared: RegExp[] = [];
  const war = manifest.web_accessible_resources;
  if (Array.isArray(war)) {
    for (const entry of war) {
      const resources =
        typeof entry === "string" ? [entry] : Array.isArray(entry?.resources) ? entry.resources : [];
      for (const r of resources) if (typeof r === "string") declared.push(globToRegExp(r));
    }
  }

  const issues: ValidationIssue[] = [];
  for (const file of files) {
    if (!contentScriptPaths.has(file.path)) continue;

    for (const match of file.content.matchAll(/chrome\.runtime\.getURL\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
      const resource = match[1].replace(/^\.?\//, "");
      if (!declared.some((re) => re.test(resource))) {
        issues.push({
          level: "warning",
          code: "web_accessible_resource_missing",
          message: `${file.path} loads "${resource}" with chrome.runtime.getURL(), but it is not listed in manifest.json "web_accessible_resources", so web pages cannot load it.`,
          path: file.path,
        });
      }
    }
  }

  return issues;
}
