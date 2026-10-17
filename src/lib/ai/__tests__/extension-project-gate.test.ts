import { beforeEach, describe, expect, it, vi } from "vitest";

const completeMock = vi.fn();
vi.mock("../index", () => ({ getAiProvider: () => ({ complete: completeMock }) }));

import { generateExtension } from "../extension";

const plan = {
  name: "Ext", description: "d", permissions: [], host_permissions: [],
  components: { background: false, content_script: false, popup: true, options_page: false },
  files_plan: ["manifest.json", "popup.html"], notes: "n",
};
const manifest = (extra: object = {}) =>
  JSON.stringify({ manifest_version: 3, name: "Ext", version: "1.0.0", description: "d", action: { default_popup: "popup.html" }, ...extra });
const output = (files: { path: string; content: string }[]) => ({ name: "Ext", description: "d", files });
const respond = (obj: unknown) => ({ text: JSON.stringify(obj), tokensUsed: 1, model: "fake" });
const HTML = '<p>hi</p><script src="popup.js"></script>';

const good = output([
  { path: "manifest.json", content: manifest() },
  { path: "popup.html", content: HTML },
  { path: "popup.js", content: "document.title = 'ok';" },
]);

const retryText = () => {
  const messages = completeMock.mock.calls[2][0].messages;
  return messages[messages.length - 1].content as string;
};

describe("generation is gated on the whole project, not only JSON and JS syntax", () => {
  beforeEach(() => completeMock.mockReset());

  it("retries when a file referenced from HTML was never generated, and names it", async () => {
    completeMock
      .mockResolvedValueOnce(respond(plan))
      .mockResolvedValueOnce(
        respond(output([{ path: "manifest.json", content: manifest() }, { path: "popup.html", content: HTML }]))
      )
      .mockResolvedValueOnce(respond(good));
    const { result } = await generateExtension("a thing");
    expect(completeMock).toHaveBeenCalledTimes(3);
    expect(retryText()).toMatch(/popup\.js/);
    expect(result.files.map((f) => f.path)).toContain("popup.js");
  });

  it("retries when the manifest has a shape Chrome refuses (object description)", async () => {
    completeMock
      .mockResolvedValueOnce(respond(plan))
      .mockResolvedValueOnce(
        respond(output([
          { path: "manifest.json", content: manifest({ description: { en: "x" } }) },
          { path: "popup.html", content: HTML },
          { path: "popup.js", content: "var a = 1;" },
        ]))
      )
      .mockResolvedValueOnce(respond(good));
    await generateExtension("a thing");
    expect(completeMock).toHaveBeenCalledTimes(3);
    expect(retryText()).toMatch(/description/);
  });

  it("retries on eval", async () => {
    completeMock
      .mockResolvedValueOnce(respond(plan))
      .mockResolvedValueOnce(
        respond(output([
          { path: "manifest.json", content: manifest() },
          { path: "popup.html", content: HTML },
          { path: "popup.js", content: "eval('1+1');" },
        ]))
      )
      .mockResolvedValueOnce(respond(good));
    await generateExtension("a thing");
    expect(completeMock).toHaveBeenCalledTimes(3);
  });

  it("does NOT retry over a hardcoded_secret match, which also hits harmless placeholders", async () => {
    completeMock.mockResolvedValueOnce(respond(plan)).mockResolvedValueOnce(
      respond(output([
        { path: "manifest.json", content: manifest() },
        { path: "popup.html", content: HTML },
        { path: "popup.js", content: 'const apiKey = "your-api-key-here";' },
      ]))
    );
    await generateExtension("a thing");
    expect(completeMock).toHaveBeenCalledTimes(2); // architect + one coder call
  });

  it("accepts a clean project on the first attempt", async () => {
    completeMock.mockResolvedValueOnce(respond(plan)).mockResolvedValueOnce(respond(good));
    await generateExtension("a thing");
    expect(completeMock).toHaveBeenCalledTimes(2);
  });
});
