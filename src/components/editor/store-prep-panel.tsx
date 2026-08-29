"use client";

import { useState } from "react";
import { Loader2, Store } from "lucide-react";

interface StorePrepResult {
  name: string;
  description: string | null;
  suggestedCategory: string;
  permissionsExplained: { permission: string; explanation: string }[];
  privacyNotes: string[];
  checklist: { label: string; done: boolean }[];
  screenshotPlaceholders: { label: string; size: string }[];
}

export function StorePrepPanel({ projectId }: { projectId: string }) {
  const [data, setData] = useState<StorePrepResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePrepare() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/store-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not prepare this listing.");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-ink-dim">
        This builds the checklist and metadata for a manual Chrome Web Store submission. ExtenAI
        does not publish extensions on your behalf.
      </p>
      <button
        onClick={handlePrepare}
        disabled={loading}
        className="flex items-center gap-2 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Store className="h-3.5 w-3.5" />}
        Prepare for Chrome Web Store
      </button>
      {error && <p className="text-bad">{error}</p>}
      {data && (
        <div className="space-y-3">
          <div className="rounded-lg border border-ink-line bg-ink-raised p-3 text-xs">
            <p className="font-medium">{data.name}</p>
            <p className="mt-1 text-ink-dim">{data.description || "No description yet."}</p>
            <p className="mt-1 text-ink-dim">Suggested category: {data.suggestedCategory}</p>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium">Permissions to explain in your listing</p>
            <ul className="space-y-1">
              {data.permissionsExplained.length === 0 && (
                <li className="text-xs text-ink-dim">No permissions declared.</li>
              )}
              {data.permissionsExplained.map((p) => (
                <li key={p.permission} className="rounded-lg border border-ink-line bg-ink-raised px-3 py-2 text-xs">
                  <span className="font-[family-name:var(--font-mono)]">{p.permission}</span>
                  <p className="mt-0.5 text-ink-dim">{p.explanation}</p>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium">Publishing checklist</p>
            <ul className="space-y-1">
              {data.checklist.map((item) => (
                <li key={item.label} className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={item.done} readOnly className="accent-accent" />
                  {item.label}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium">Privacy notes</p>
            <ul className="list-disc space-y-1 pl-4 text-xs text-ink-dim">
              {data.privacyNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
