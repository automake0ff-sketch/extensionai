"use client";

import { useState } from "react";
import { Loader2, FlaskConical, CircleCheck, CircleAlert } from "lucide-react";
import type { TestPlanResult } from "@/lib/types";

export function TestPlanPanel({ projectId }: { projectId: string }) {
  const [plan, setPlan] = useState<TestPlanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not generate a test plan.");
      setPlan(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-ink-dim">
        Produces a static test plan — structural checks the system reasons about, plus items that
        need a human to actually run the extension. Nothing here is ever reported as &ldquo;executed.&rdquo;
      </p>
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="flex items-center gap-2 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
        Generate test plan
      </button>
      {error && <p className="text-bad">{error}</p>}
      {plan && (
        <ul className="space-y-2">
          {plan.cases.map((c, i) => (
            <li key={i} className="flex items-start gap-2 rounded-lg border border-ink-line bg-ink-raised px-3 py-2 text-xs">
              {c.status === "planned" ? (
                <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-good" />
              ) : (
                <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" />
              )}
              <div>
                <p>{c.title}</p>
                {c.notes && <p className="mt-0.5 text-ink-dim">{c.notes}</p>}
                <p className="mt-0.5 text-[10px] uppercase tracking-wide text-ink-dim">
                  {c.status === "planned" ? "Statically checked" : "Manual verification required"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
