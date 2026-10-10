import { describe, expect, it } from "vitest";
import { validateInnerHtmlUsage, validateWebAccessibleResources } from "../practices";

const f = (path: string, content: string) => ({ path, content });

describe("validateInnerHtmlUsage", () => {
  it("warns on innerHTML built by unescaped concatenation", () => {
    const issues = validateInnerHtmlUsage([f("popup.js", "el.innerHTML = '<li>' + item.title + '</li>';")]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ level: "warning", code: "inner_html_dynamic", path: "popup.js" });
    expect(issues[0].message).toMatch(/line 1/);
  });

  it("warns on unescaped template interpolation", () => {
    expect(validateInnerHtmlUsage([f("a.js", "box.innerHTML = `<b>${name}</b>`;")])).toHaveLength(1);
  });

  it("does not warn on a plain static string", () => {
    expect(validateInnerHtmlUsage([f("a.js", "el.innerHTML = '<p>No results</p>';")])).toEqual([]);
  });

  it("does not warn when the value goes through an escape helper (the common correct pattern)", () => {
    const code = "el.innerHTML = '<p>' + escapeHtml(item.message) + '</p>';";
    expect(validateInnerHtmlUsage([f("ui.js", code)])).toEqual([]);
  });

  it("does not judge a bare identifier it cannot see into", () => {
    expect(validateInnerHtmlUsage([f("ui.js", "contentEl.innerHTML = html;")])).toEqual([]);
  });

  it("reports at most once per file and ignores non-js files", () => {
    const bad = "a.innerHTML = '<i>' + x + '</i>';\nb.innerHTML = '<i>' + y + '</i>';";
    expect(validateInnerHtmlUsage([f("a.js", bad)])).toHaveLength(1);
    expect(validateInnerHtmlUsage([f("README.md", bad)])).toEqual([]);
  });
});

const manifestWith = (extra: object) =>
  f("manifest.json", JSON.stringify({ manifest_version: 3, name: "x", version: "1.0.0", ...extra }));

describe("validateWebAccessibleResources", () => {
  const script = (path = "content.js") =>
    f(path, "const img = document.createElement('img'); img.src = chrome.runtime.getURL('assets/logo.svg');");

  it("warns when a content script loads an undeclared resource", () => {
    const issues = validateWebAccessibleResources([
      manifestWith({ content_scripts: [{ matches: ["https://a.com/*"], js: ["content.js"] }] }),
      script(),
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ level: "warning", code: "web_accessible_resource_missing", path: "content.js" });
    expect(issues[0].message).toMatch(/assets\/logo\.svg/);
  });

  it("accepts an exact declaration and a glob declaration", () => {
    for (const resources of [["assets/logo.svg"], ["assets/*"]]) {
      const issues = validateWebAccessibleResources([
        manifestWith({
          content_scripts: [{ matches: ["https://a.com/*"], js: ["content.js"] }],
          web_accessible_resources: [{ resources, matches: ["https://a.com/*"] }],
        }),
        script(),
      ]);
      expect(issues).toEqual([]);
    }
  });

  it("does not check scripts that are not content scripts (extension pages can load their own files)", () => {
    const issues = validateWebAccessibleResources([
      manifestWith({ action: { default_popup: "popup.html" } }),
      script("popup.js"),
    ]);
    expect(issues).toEqual([]);
  });

  it("is silent without a manifest or with an unparseable one", () => {
    expect(validateWebAccessibleResources([script()])).toEqual([]);
    expect(validateWebAccessibleResources([f("manifest.json", "{ nope"), script()])).toEqual([]);
  });
});
