import { describe, expect, it } from "vitest";
import { validateProject } from "../index";

const f = (path: string, content: string) => ({ path, content });
const manifest = f(
  "manifest.json",
  JSON.stringify({ manifest_version: 3, name: "x", version: "1.0.0", description: "d", action: { default_popup: "popup.html" } })
);
const run = (html: string, ...others: { path: string; content: string }[]) =>
  validateProject([manifest, f("popup.html", html), ...others]);
const refIssues = (r: ReturnType<typeof run>) =>
  r.issues.filter((i) => i.code === "missing_script_reference" || i.code === "missing_html_reference");

describe("HTML references to project files", () => {
  it("a missing <script src> is an error: the popup loads but nothing in it works", () => {
    const result = run('<button id="go">Go</button><script src="popup.js"></script>');
    const issue = result.issues.find((i) => i.code === "missing_script_reference");
    expect(issue).toMatchObject({ level: "error", path: "popup.html" });
    expect(issue!.message).toMatch(/popup\.js/);
    expect(result.valid).toBe(false);
  });

  it("a missing stylesheet stays a warning and does not block", () => {
    const result = run('<link rel="stylesheet" href="style.css"><script src="popup.js"></script>', f("popup.js", "var a=1;"));
    const issue = result.issues.find((i) => i.code === "missing_html_reference");
    expect(issue).toMatchObject({ level: "warning" });
    expect(result.valid).toBe(true);
  });

  it("accepts references that exist, including ./, a leading slash and a cache-busting query", () => {
    for (const src of ["popup.js", "./popup.js", "/popup.js", "popup.js?v=2"]) {
      const result = run(`<script src="${src}"></script>`, f("popup.js", "var a=1;"));
      expect(refIssues(result), src).toEqual([]);
    }
  });

  it("ignores things that are not project files: anchors, mailto, data URIs, remote and protocol-relative URLs", () => {
    const html = [
      '<a href="#top">top</a>',
      '<a href="mailto:me@example.com">mail</a>',
      '<img src="data:image/png;base64,AAAA">',
      '<a href="https://example.com/page">site</a>',
      '<a href="//cdn.example.com/x">cdn</a>',
    ].join("");
    expect(refIssues(run(html))).toEqual([]);
  });

  it("resolves relative paths from the HTML file's own folder", () => {
    const result = validateProject([
      f("manifest.json", JSON.stringify({ manifest_version: 3, name: "x", version: "1.0.0", description: "d", side_panel: { default_path: "ui/panel.html" } })),
      f("ui/panel.html", '<script src="panel.js"></script><script src="../shared.js"></script>'),
      f("ui/panel.js", "var a=1;"),
      f("shared.js", "var b=2;"),
    ]);
    expect(refIssues(result)).toEqual([]);
  });
});
