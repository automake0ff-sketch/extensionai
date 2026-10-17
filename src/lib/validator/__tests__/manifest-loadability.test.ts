import { describe, expect, it } from "vitest";
import { validateProject } from "../index";
import { validateManifest } from "../manifest";

const manifest = (extra: object) =>
  JSON.stringify({ manifest_version: 3, name: "x", version: "1.0.0", description: "A test.", ...extra });
const codes = (m: string, level?: "error" | "warning") =>
  validateManifest(m)
    .filter((i) => !level || i.level === level)
    .map((i) => i.code);

describe("description", () => {
  it('rejects a non-string description (Chrome: "Not a valid tree for key description")', () => {
    expect(codes(manifest({ description: { en: "Hello" } }), "error")).toContain("manifest_description_invalid");
    expect(codes(manifest({ description: ["a", "b"] }), "error")).toContain("manifest_description_invalid");
    expect(codes(manifest({ description: 5 }), "error")).toContain("manifest_description_invalid");
  });

  it("accepts a plain string, and a missing description", () => {
    expect(codes(manifest({}), "error")).toEqual([]);
    const withoutDescription = JSON.parse(manifest({}));
    delete withoutDescription.description;
    expect(codes(JSON.stringify(withoutDescription), "error")).toEqual([]);
  });

  it("warns, not errors, past 132 characters (only the Web Store enforces it)", () => {
    expect(codes(manifest({ description: "a".repeat(133) }), "warning")).toContain("manifest_description_long");
    expect(codes(manifest({ description: "a".repeat(133) }), "error")).toEqual([]);
    expect(codes(manifest({ description: "a".repeat(132) }))).not.toContain("manifest_description_long");
  });
});

describe("version format", () => {
  it("accepts 1 to 4 dot-separated numbers", () => {
    for (const version of ["1", "1.0", "1.0.0", "1.2.3.4", "65535.0.0"]) {
      expect(codes(manifest({ version }), "error"), version).toEqual([]);
    }
  });

  it("rejects anything Chrome refuses", () => {
    for (const version of ["1.0.0-beta", "v1.0", "1.0.0.0.0", "65536.0", "1..0", "one"]) {
      expect(codes(manifest({ version }), "error"), version).toContain("manifest_version_format");
    }
  });
});

describe("commands", () => {
  it("requires a description on every command except _execute_*", () => {
    const bad = manifest({ commands: { "open-panel": { suggested_key: { default: "Ctrl+Shift+Y" } } } });
    expect(codes(bad, "error")).toContain("manifest_command_description");
    const empty = manifest({ commands: { go: { description: "  " } } });
    expect(codes(empty, "error")).toContain("manifest_command_description");
    const exempt = manifest({ commands: { _execute_action: { suggested_key: { default: "Ctrl+Shift+Y" } } } });
    expect(codes(exempt, "error")).toEqual([]);
  });

  it("allows 4 shortcuts and rejects 5", () => {
    const make = (n: number) =>
      manifest({
        commands: Object.fromEntries(
          Array.from({ length: n }, (_, i) => [`c${i}`, { description: `cmd ${i}`, suggested_key: { default: `Ctrl+Shift+${i}` } }])
        ),
      });
    expect(codes(make(4), "error")).toEqual([]);
    expect(codes(make(5), "error")).toContain("manifest_commands_shortcuts");
  });

  it("rejects commands that is not an object", () => {
    expect(codes(manifest({ commands: ["a"] }), "error")).toContain("manifest_commands_invalid");
  });
});

describe("key and localization", () => {
  it("rejects a made-up key and accepts a plausible base64 one", () => {
    expect(codes(manifest({ key: "YOUR_PUBLIC_KEY_HERE" }), "error")).toContain("manifest_key_invalid");
    expect(codes(manifest({ key: "A".repeat(392) }), "error")).toEqual([]);
  });

  it("rejects __MSG_ strings without a default_locale", () => {
    expect(codes(manifest({ name: "__MSG_extName__" }), "error")).toContain("manifest_msg_without_locale");
  });

  it("with a default_locale, the messages file must exist", () => {
    const m = manifest({ name: "__MSG_extName__", default_locale: "en" });
    const file = (path: string, content: string) => ({ path, content });
    const missing = validateProject([file("manifest.json", m)]);
    expect(missing.issues.some((i) => i.code === "missing_referenced_file" && i.path === "_locales/en/messages.json")).toBe(true);
    const present = validateProject([file("manifest.json", m), file("_locales/en/messages.json", "{}")]);
    expect(present.issues.some((i) => i.code === "missing_referenced_file")).toBe(false);
  });
});
