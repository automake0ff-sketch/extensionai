import { describe, expect, it } from "vitest";
import { requestNeedsLlm } from "../llm-usage";

describe("requestNeedsLlm", () => {
  it("detects the real prompt that produced an extension asking for an API key", () => {
    expect(
      requestNeedsLlm(
        'Crea una extensión de Chrome V3 que lea la web actual y tenga dos botones: "Generar Esquema" y "Generar Test de 3 preguntas"'
      )
    ).toBe(true);
  });

  it("detects common AI tasks in Spanish and English", () => {
    for (const prompt of [
      "resume la página que estoy leyendo",
      "Summarize any article with one click",
      "traduce el texto seleccionado",
      "extension that rewrites my emails",
      "un chatbot en el lateral",
      "genera un resumen del artículo",
      "usa ChatGPT para explicar el código",
      "extensión con IA para estudiar",
      "an AI helper for cover letters",
    ]) {
      expect(requestNeedsLlm(prompt), prompt).toBe(true);
    }
  });

  it("stays false for the extensions that need no model", () => {
    for (const prompt of [
      "extensión que cuente las palabras de la página",
      "auditor seo",
      "calculadora gastos",
      "Bloqueador de distracciones inteligente",
      "Crea una extensión que audite el SEO de una página y diga qué le falta.",
      "dark mode toggle for every site",
    ]) {
      expect(requestNeedsLlm(prompt), prompt).toBe(false);
    }
  });

  it("also looks at what the Architect planned", () => {
    expect(requestNeedsLlm("herramienta de estudio", { notes: "Calls an LLM to produce the quiz." })).toBe(true);
    expect(requestNeedsLlm("herramienta de estudio", { host_permissions: ["https://api.openai.com/*"] })).toBe(true);
    expect(requestNeedsLlm("herramienta de estudio", { notes: "Stores a list in chrome.storage." })).toBe(false);
  });
});
