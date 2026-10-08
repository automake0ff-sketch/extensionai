import { beforeEach, describe, expect, it, vi } from "vitest";

// generateExtension()/modifyExtension() get their provider from getAiProvider();
// replace it with a scripted fake so each test controls exactly what the
// "model" returns on every call, in order.
const completeMock = vi.fn();
vi.mock("../index", () => ({
  getAiProvider: () => ({ complete: completeMock }),
}));

import { generateExtension, modifyExtension } from "../extension";

const plan = {
  name: "Test Ext",
  description: "d",
  permissions: [],
  host_permissions: [],
  components: { background: false, content_script: false, popup: true, options_page: false },
  files_plan: ["manifest.json", "popup.html"],
  notes: "n",
};

const validManifest = JSON.stringify({
  manifest_version: 3,
  name: "Test Ext",
  version: "1.0.0",
  action: { default_popup: "popup.html" },
});

const respond = (obj: unknown) => ({ text: JSON.stringify(obj), tokensUsed: 10, model: "fake" });

describe("generateExtension validation + retry", () => {
  beforeEach(() => {
    completeMock.mockReset();
  });

  it("retries when manifest.json content is not valid JSON, and accepts the corrected retry", async () => {
    const brokenManifest = '{ "manifest_version": 3, "name": "Test Ext", }'; // trailing comma
    completeMock
      .mockResolvedValueOnce(respond(plan)) // architect
      .mockResolvedValueOnce(
        respond({
          name: "Test Ext",
          description: "d",
          files: [
            { path: "manifest.json", content: brokenManifest },
            { path: "popup.html", content: "<p>hi</p>" },
          ],
        })
      ) // coder attempt 1: broken manifest
      .mockResolvedValueOnce(
        respond({
          name: "Test Ext",
          description: "d",
          files: [
            { path: "manifest.json", content: validManifest },
            { path: "popup.html", content: "<p>hi</p>" },
          ],
        })
      ); // coder attempt 2: fixed

    const { result } = await generateExtension("make a thing");

    expect(completeMock).toHaveBeenCalledTimes(3);
    expect(result.files.find((f) => f.path === "manifest.json")!.content).toBe(validManifest);
    // The retry request must tell the model what was wrong.
    const retryMessages = completeMock.mock.calls[2][0].messages;
    expect(retryMessages[retryMessages.length - 1].content).toMatch(/not valid JSON/);
  });

  it("does not retry for manifest warnings (only errors force a retry)", async () => {
    // Broad host permission produces a warning-level note from validateManifest.
    const warnManifest = JSON.stringify({
      manifest_version: 3,
      name: "Test Ext",
      version: "1.0.0",
      host_permissions: ["<all_urls>"],
      action: { default_popup: "popup.html" },
    });
    completeMock.mockResolvedValueOnce(respond(plan)).mockResolvedValueOnce(
      respond({
        name: "Test Ext",
        description: "d",
        files: [
          { path: "manifest.json", content: warnManifest },
          { path: "popup.html", content: "<p>hi</p>" },
        ],
      })
    );

    await generateExtension("make a thing");
    expect(completeMock).toHaveBeenCalledTimes(2); // architect + one coder call, no retry
  });

  it("gives up with a validation error after 3 attempts if the manifest stays broken", async () => {
    const broken = respond({
      name: "Test Ext",
      description: "d",
      files: [{ path: "manifest.json", content: "{ not json" }],
    });
    completeMock
      .mockResolvedValueOnce(respond(plan))
      .mockResolvedValueOnce(broken)
      .mockResolvedValueOnce(broken)
      .mockResolvedValueOnce(broken);

    await expect(generateExtension("make a thing")).rejects.toThrow(/not valid JSON/);
    expect(completeMock).toHaveBeenCalledTimes(4); // architect + 3 coder attempts
  });
});

describe("modifyExtension validation + retry", () => {
  beforeEach(() => {
    completeMock.mockReset();
  });

  const files = [
    { path: "manifest.json", content: validManifest },
    { path: "popup.html", content: "<p>hi</p>" },
  ] as never;

  it("retries when a chat edit leaves manifest.json as invalid JSON", async () => {
    completeMock
      .mockResolvedValueOnce(
        respond({
          message: "done",
          changes: [{ path: "manifest.json", action: "update", content: '{ "manifest_version": 3, }' }],
        })
      )
      .mockResolvedValueOnce(
        respond({
          message: "fixed",
          changes: [{ path: "manifest.json", action: "update", content: validManifest }],
        })
      );

    const { result } = await modifyExtension({ userMessage: "add a thing", files, recentMessages: [] });
    expect(completeMock).toHaveBeenCalledTimes(2);
    expect(result.message).toBe("fixed");
  });

  it("does not validate manifest.json when the edit does not touch it", async () => {
    completeMock.mockResolvedValueOnce(
      respond({
        message: "ok",
        changes: [{ path: "popup.html", action: "update", content: "<p>changed</p>" }],
      })
    );
    await modifyExtension({ userMessage: "tweak html", files, recentMessages: [] });
    expect(completeMock).toHaveBeenCalledTimes(1);
  });
});
