/**
 * Detection of generated code that talks to a language-model API. Shared by
 * the validator (is the host declared in the manifest?), and the generate
 * route (tell the user the extension needs an API key). Pure string
 * analysis: nothing here executes generated code.
 */

type FileLike = { path: string; content: string };

const LLM_HOST_PATTERN =
  /\b(api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|openrouter\.ai|api\.groq\.com|api\.mistral\.ai|api\.deepseek\.com|api\.together\.xyz|api\.perplexity\.ai|api\.cohere\.com|localhost:11434|127\.0\.0\.1:11434)/g;

/** Unique LLM API hostnames (ports stripped) referenced from .js/.html files. READMEs and the manifest are ignored on purpose. */
export function findLlmHostsInCode(files: FileLike[]): string[] {
  const found = new Set<string>();
  for (const file of files) {
    if (!/\.(js|html)$/.test(file.path)) continue;
    for (const match of file.content.matchAll(LLM_HOST_PATTERN)) {
      found.add(match[1].replace(/:\d+$/, ""));
    }
  }
  return [...found];
}

/** Does a manifest match pattern (host_permissions entry) cover this hostname? */
function patternCoversHost(pattern: string, host: string): boolean {
  if (pattern === "<all_urls>" || pattern === "*://*/*") return true;
  const match = pattern.match(/^(?:\*|https?):\/\/([^/]+)\/.*$/);
  if (!match) return false;
  const hostPattern = match[1].replace(/:\d+$/, "");
  if (hostPattern === "*") return true;
  if (hostPattern.startsWith("*.")) {
    const suffix = hostPattern.slice(2);
    return host === suffix || host.endsWith("." + suffix);
  }
  return hostPattern === host;
}

/**
 * LLM hosts the code calls that the manifest does not cover with
 * host_permissions or optional_host_permissions (the latter is how an
 * extension asks for a user-chosen endpoint at runtime).
 */
export function uncoveredLlmHosts(files: FileLike[]): string[] {
  const hosts = findLlmHostsInCode(files);
  if (hosts.length === 0) return [];

  const manifestFile = files.find((f) => f.path === "manifest.json");
  let patterns: string[] = [];
  if (manifestFile) {
    try {
      const manifest = JSON.parse(manifestFile.content);
      for (const key of ["host_permissions", "optional_host_permissions"]) {
        if (Array.isArray(manifest[key])) patterns.push(...manifest[key].filter((p: unknown) => typeof p === "string"));
      }
    } catch {
      patterns = []; // unparseable manifest is reported elsewhere
    }
  }
  return hosts.filter((host) => !patterns.some((p) => patternCoversHost(p, host)));
}

/** One-line note appended to the chat message when a generated extension needs the user's own API key. */
export function describeLlmNotice(hosts: string[]): string {
  if (hosts.length === 0) return "";
  if (hosts.length >= 3) {
    return ` Heads up: this extension can use several AI providers (${hosts.join(", ")}). Whoever uses it picks one in its Options page and needs that provider's API key; Groq and Google Gemini offer free keys, and Ollama runs locally and needs none. This preview can't run that part.`;
  }
  return ` Heads up: this extension calls an AI service (${hosts.join(", ")}), so whoever uses it needs their own API key. After loading it in Chrome, open its Options page and paste one. This preview can't run that part.`;
}
