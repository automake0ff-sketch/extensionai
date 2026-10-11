import { beforeEach, describe, expect, it, vi } from "vitest";

const completeMock = vi.fn();
vi.mock("../index", () => ({
  getAiProvider: () => ({ complete: completeMock }),
}));

import { generateExtension } from "../extension";
import { AI_FEATURES_RECIPE, CODER_PROMPT } from "../prompts";

const plan = {
  name: "Ext",
  description: "d",
  permissions: [],
  host_permissions: [],
  components: { background: false, content_script: false, popup: true, options_page: false },
  files_plan: ["manifest.json", "popup.html"],
  notes: "n",
};
const manifest = JSON.stringify({ manifest_version: 3, name: "Ext", version: "1.0.0", action: { default_popup: "popup.html" } });
const coderOutput = {
  name: "Ext",
  description: "d",
  files: [
    { path: "manifest.json", content: manifest },
    { path: "popup.html", content: "<p>hi</p>" },
  ],
};
const respond = (obj: unknown) => ({ text: JSON.stringify(obj), tokensUsed: 1, model: "fake" });

describe("AI-features recipe injection", () => {
  beforeEach(() => completeMock.mockReset());

  it("gives the Coder the recipe when the request needs a language model", async () => {
    completeMock.mockResolvedValueOnce(respond(plan)).mockResolvedValueOnce(respond(coderOutput));
    await generateExtension('botones "Generar Esquema" y "Generar Test de 3 preguntas" de la página');

    const coderSystem = completeMock.mock.calls[1][0].system as string;
    expect(coderSystem.startsWith(CODER_PROMPT)).toBe(true);
    expect(coderSystem).toContain(AI_FEATURES_RECIPE);
    expect(coderSystem).toContain("brings their own API key");
  });

  it("keeps the shorter prompt for requests that need no model", async () => {
    completeMock.mockResolvedValueOnce(respond(plan)).mockResolvedValueOnce(respond(coderOutput));
    await generateExtension("extensión que cuente las palabras de la página");

    expect(completeMock.mock.calls[1][0].system).toBe(CODER_PROMPT);
  });

  it("keeps the recipe on the Coder retry too", async () => {
    completeMock
      .mockResolvedValueOnce(respond(plan))
      .mockResolvedValueOnce({ text: "{ not json", tokensUsed: 1, model: "fake" })
      .mockResolvedValueOnce(respond(coderOutput));
    await generateExtension("resume la página con IA");

    expect(completeMock).toHaveBeenCalledTimes(3);
    expect(completeMock.mock.calls[2][0].system).toContain(AI_FEATURES_RECIPE);
  });
});
