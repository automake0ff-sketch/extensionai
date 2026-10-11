import { findLlmHostsInCode } from "../llm-hosts";

// Does the request need a language model inside the generated extension?
// Used only to decide whether the Coder gets the extra "AI features" recipe,
// so a false positive costs a longer prompt and a false negative costs the
// recipe -- neither breaks anything. Spanish and English, because the
// requests come in both.
const LLM_NAMES = /\b(gpt|chatgpt|openai|claude|anthropic|gemini|llm|openrouter|ollama|copilot|deepseek|mistral)\b/i;
const AI_ACRONYM = /\b(IA|AI)\b/; // case-sensitive on purpose: "ia" is not a word, "IA"/"AI" is
const AI_PHRASES = /inteligencia artificial|artificial intelligence|machine learning/i;
const AI_TASKS =
  /\b(resum\w*|summar\w*|traduc\w*|translat\w*|reescrib\w*|rewrit\w*|parafras\w*|paraphras\w*|quiz|flashcards?|chatbot|esquema|outline)\b/i;
const GENERATE_CONTENT =
  /\bgenera\w*\s+(?:un|una|el|la|los|las|unos|unas)?\s*(?:test|quiz|esquema|resumen|texto|respuestas?|correo|email|mensaje|post)\b/i;

export function requestNeedsLlm(
  prompt: string,
  plan?: { name?: string; description?: string; notes?: string; host_permissions?: string[] }
): boolean {
  const planText = plan
    ? [plan.name, plan.description, plan.notes, ...(plan.host_permissions ?? [])].filter(Boolean).join(" ")
    : "";
  const text = `${prompt} ${planText}`;

  return (
    LLM_NAMES.test(text) ||
    AI_ACRONYM.test(text) ||
    AI_PHRASES.test(text) ||
    AI_TASKS.test(text) ||
    GENERATE_CONTENT.test(text) ||
    findLlmHostsInCode([{ path: "plan.html", content: text }]).length > 0
  );
}
