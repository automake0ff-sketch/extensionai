"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";

const TEMPLATES = [
  { name: "Gmail productivity", prompt: "Create a Chrome extension that adds quick reply templates and a snooze button to Gmail." },
  { name: "Amazon tools", prompt: "Create a Chrome extension that extracts product names and prices from Amazon and exports them to CSV." },
  { name: "LinkedIn tools", prompt: "Create a Chrome extension that saves the LinkedIn profile I'm viewing to a local list I can export as CSV." },
  { name: "YouTube tools", prompt: "Create a Chrome extension that adds a button to copy the current YouTube video's transcript." },
  { name: "SEO tools", prompt: "Create a Chrome extension that audits the current page's title, meta description, and heading structure." },
  { name: "Screenshot tools", prompt: "Create a Chrome extension that captures a full-page screenshot and lets me download it as PNG." },
  { name: "Productivity tools", prompt: "Create a Chrome extension that blocks distracting sites during a focus timer I control from the popup." },
];

export default function NewProjectPage() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const createRes = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: prompt.slice(0, 60), description: prompt }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error ?? "Could not create the project.");

      const projectId = createData.project.id;

      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, prompt }),
      });
      const genData = await genRes.json();
      if (!genRes.ok) throw new Error(genData.error ?? "We couldn't generate your extension.");

      router.push(`/projects/${projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-14">
      <h1 className="text-center font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
        What do you want to build?
      </h1>
      <p className="mt-2 text-center text-ink-dim">
        Describe the browser extension you want. ExtenAI plans the permissions and writes the code.
      </p>

      <div className="mt-8">
        <div className="omnibox p-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            disabled={loading}
            placeholder="Create a Chrome extension that extracts product prices from Amazon and lets me export them to CSV."
            className="w-full resize-none rounded-2xl bg-transparent px-4 py-3 text-sm outline-none placeholder:text-ink-dim disabled:opacity-60"
          />
        </div>
        {error && <p className="mt-3 text-sm text-bad">{error}</p>}
        <button
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? "Building your extension…" : "Generate extension"}
        </button>
      </div>

      <div className="mt-12">
        <p className="mb-3 text-sm text-ink-dim">Or start from a template</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.name}
              onClick={() => setPrompt(t.prompt)}
              disabled={loading}
              className="rounded-2xl border border-ink-line bg-ink-raised p-4 text-left text-sm hover:border-accent disabled:opacity-60"
            >
              <span className="font-medium">{t.name}</span>
              <p className="mt-1 line-clamp-2 text-ink-dim">{t.prompt}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
