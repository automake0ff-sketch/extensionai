"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { GithubMark } from "@/components/brand/github-mark";

export function GithubExportModal({
  projectId,
  defaultRepoName,
  onClose,
}: {
  projectId: string;
  defaultRepoName: string;
  onClose: () => void;
}) {
  const [repoName, setRepoName] = useState(defaultRepoName);
  const [isPrivate, setIsPrivate] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repoUrl, setRepoUrl] = useState<string | null>(null);

  async function handleExport() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/github/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, repoName, private: isPrivate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "We couldn't export this project to GitHub.");
      setRepoUrl(data.repoUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-ink-line bg-ink-raised p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <GithubMark className="h-4 w-4" /> Export to GitHub
          </h2>
          <button onClick={onClose} className="text-ink-dim hover:text-ink-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {repoUrl ? (
          <div className="mt-4 text-sm">
            <p className="text-good">Exported as a single commit.</p>
            <a href={repoUrl} target="_blank" rel="noreferrer" className="mt-2 block truncate text-accent hover:underline">
              {repoUrl}
            </a>
            <button onClick={onClose} className="mt-4 w-full rounded-full border border-ink-line py-2 text-sm hover:bg-ink">
              Close
            </button>
          </div>
        ) : (
          <>
            <label className="mt-4 block text-xs text-ink-dim">Repository name</label>
            <input
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              disabled={loading}
              className="mt-1 w-full rounded-lg border border-ink-line bg-ink px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-60"
            />
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                disabled={loading}
                className="accent-accent"
              />
              Private repository
            </label>

            {error && <p className="mt-3 text-sm text-bad">{error}</p>}

            <button
              onClick={handleExport}
              disabled={loading || !repoName.trim()}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-accent py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Create repository &amp; push
            </button>
          </>
        )}
      </div>
    </div>
  );
}
