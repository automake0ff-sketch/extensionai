import { describe, expect, it } from "vitest";
import { extractJson, repairJsonStrings } from "../schemas";

describe("extractJson", () => {
  it("parses plain JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("strips a markdown fence wrapping the whole response", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("ignores prose around the object", () => {
    expect(extractJson('Here you go:\n{"a":1}\nHope it helps!')).toEqual({ a: 1 });
  });

  it("does not mistake a code fence inside a string value for the wrapper", () => {
    const raw = '{"content":"# Title\\n```js\\nconsole.log(1)\\n```\\n"}';
    expect(extractJson(raw)).toEqual({ content: "# Title\n```js\nconsole.log(1)\n```\n" });
  });

  it("repairs invalid escapes such as a regex \\d written with one backslash", () => {
    // The model emitted: {"content":"const r = /\d+/;"}  (invalid JSON)
    const raw = '{"content":"const r = /\\d+/;"}';
    expect(() => JSON.parse(raw)).toThrow();
    expect(extractJson(raw)).toEqual({ content: "const r = /\\d+/;" });
  });

  it("repairs raw newlines and tabs inside strings", () => {
    const raw = '{"content":"line1\nline2\tend"}';
    expect(() => JSON.parse(raw)).toThrow();
    expect(extractJson(raw)).toEqual({ content: "line1\nline2\tend" });
  });

  it("leaves already-valid escapes untouched", () => {
    const raw = '{"content":"a\\nb \\"q\\" \\\\ \\u0041"}';
    expect(extractJson(raw)).toEqual({ content: 'a\nb "q" \\ A' });
    expect(repairJsonStrings(raw)).toBe(raw);
  });

  it("still throws on genuinely broken JSON", () => {
    expect(() => extractJson('{"a": ')).toThrow();
  });
});
