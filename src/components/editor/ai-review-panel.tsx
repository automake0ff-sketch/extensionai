"use client";

import { useState } from "react";
import { Loader2, Sparkles, ShieldAlert } from "lucide-react";
import type { ExtensionAnalysisResult } from "@/lib/types";

/**
 * Spec section 33's "Reviewer" role (lib/ai/extension.ts#analyzeExtension,
 * served by POST /api/analyze) — an AI-driven audit of permissions, security
 * patterns, and coherence, distinct from the static validator above it.
 * Kept as an on-demand action rather than running automatically, since it
 * spends an AI credit and the static validator already covers the same
 * ground for free.
 */
export function AiReviewPanel({ projectId }: { projectId: string }) {
  const [result, setResult] = useState<ExtensionAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReview() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not run the AI review.");
      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 border-t border-ink-line pt-4 text-sm">
      <p className="text-xs text-ink-dim">
        The checks above are static (no AI call). For a deeper look at whether permissions actually
        match what the code does, run an AI review.
      </p>
      <button
        onClick={handleReview}
        disabled={loading}
        className="mt-3 flex items-center gap-2 rounded-full border border-ink-line px-3 py-1.5 text-xs hover:bg-ink-raised disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        Run AI review
      </button>
      {error && <p className="mt-2 text-bad">{error}</p>}
      {result && (
        <div className="mt-3 space-y-3">
          <p className="text-ink-dim">{result.summary}</p>
          {result.unnecessaryPermissions.length > 0 && (
            <div>
              <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-warn">
                <ShieldAlert className="h-3.5 w-3.5" /> Possibly unnecessary permissions
              </p>
              <ul className="list-disc space-y-0.5 pl-5 text-xs text-ink-dim">
                {result.unnecessaryPermissions.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          {result.risks.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-bad">Risks flagged</p>
              <ul className="list-disc space-y-0.5 pl-5 text-xs text-ink-dim">
                {result.risks.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          {result.risks.length === 0 && result.unnecessaryPermissions.length === 0 && (
            <p className="text-xs text-good">No additional risks or unnecessary permissions found.</p>
          )}
        </div>
      )}
    </div>
  );
}
