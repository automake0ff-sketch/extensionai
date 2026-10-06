import { describe, expect, it } from "vitest";
import { validateJsSyntax } from "../js-syntax";

const f = (path: string, content: string) => ({ path, content });

describe("validateJsSyntax", () => {
  it("flags the real bug seen in production: an unquoted hyphenated object key", () => {
    const content = `var scores = {
      good: { color: '#1a7f37' },
      needs-improvement: { color: '#9a6700' }
    };`;
    const issues = validateJsSyntax([f("ui.js", content)]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ level: "error", code: "js_syntax_error", path: "ui.js" });
    expect(issues[0].message).toMatch(/ui\.js/);
  });

  it("passes valid JavaScript, hyphenated keys included when quoted", () => {
    const content = `var scores = {
      good: { color: '#1a7f37' },
      'needs-improvement': { color: '#9a6700' }
    };
    function run() { return scores.good.color; }`;
    expect(validateJsSyntax([f("ui.js", content)])).toEqual([]);
  });

  it("ignores non-.js files entirely", () => {
    expect(validateJsSyntax([f("manifest.json", "{ this is not json or js :::")])).toEqual([]);
    expect(validateJsSyntax([f("popup.html", "<div onclick=\"x-y()\">")])).toEqual([]);
  });

  it("does not flag code using import/export (treated as an ES module, unverifiable here)", () => {
    const content = `import { foo } from "./foo.js";\nexport function bar() { return foo(); }`;
    expect(validateJsSyntax([f("background.js", content)])).toEqual([]);
  });

  it("checks every .js file independently and reports all failures", () => {
    const broken1 = f("a.js", "var x = {bad-key: 1};");
    const broken2 = f("b.js", "function f( { ;;; ");
    const ok = f("c.js", "var y = 1;");
    const issues = validateJsSyntax([broken1, ok, broken2]);
    expect(issues.map((i) => i.path).sort()).toEqual(["a.js", "b.js"]);
  });
});
