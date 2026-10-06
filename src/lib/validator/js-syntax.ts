import vm from "node:vm";
import type { ValidationIssue } from "@/lib/types";

// Deliberately narrower than ProjectFile (which also carries db-only fields
// like id/project_id/created_at/updated_at): this only ever needs path +
// content, and the AI pipeline's generated-file shape (schemas.ts) doesn't
// have the rest. A full ProjectFile[] still satisfies this structurally.
type JsSyntaxCheckable = { path: string; content: string };

/**
 * Catches JavaScript that doesn't even parse -- confirmed necessary in
 * production: an AI-generated ui.js had an unquoted hyphenated object key
 * (`needs-improvement: {...}`, parsed as `needs - improvement`), a hard
 * SyntaxError that breaks the whole script. Nothing else in the validator
 * ever looked at JS file *content* (only manifest structure and dangerous
 * API patterns), so this shipped as "ready" and only surfaced once the
 * user actually loaded the extension in Chrome.
 *
 * vm.Script compiles without executing: it throws on a genuine syntax
 * error but never runs a single line of the file's actual logic, which
 * matters here since this content is AI-generated and untrusted.
 *
 * Content/background scripts for a Manifest V3 extension are almost
 * always plain classic scripts (chrome.* globals, no bundler), not ES
 * modules -- generated code using import/export is both rare and, as far
 * as this validator is concerned, unverifiable without resolving a real
 * module graph. Rather than false-positive on that, a module-syntax error
 * (import/export at the top level) is treated as "not checked", not
 * "invalid".
 */
export function validateJsSyntax(files: JsSyntaxCheckable[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const file of files) {
    if (!file.path.endsWith(".js")) continue;

    try {
      new vm.Script(file.content, { filename: file.path });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/\b(import|export)\b/.test(message) || /Unexpected (token 'export'|identifier|string)/.test(message)) {
        // Plausibly an ES module (import/export) rather than a genuine
        // mistake -- skip instead of risking a false positive.
        continue;
      }
      issues.push({
        level: "error",
        code: "js_syntax_error",
        message: `${file.path} has a JavaScript syntax error and will fail to load: ${message}`,
        path: file.path,
      });
    }
  }

  return issues;
}
