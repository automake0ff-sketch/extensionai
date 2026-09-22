"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

export function WaitlistForm({ className = "" }: { className?: string }) {
  const [email, setEmail] = useState("");
  const [niche, setNiche] = useState("");
  const [loading, setLoading] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, niche: niche || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setJoined(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (joined) {
    return (
      <div className={`flex items-center justify-center gap-2 rounded-full border border-good/40 bg-good/10 px-5 py-3 text-sm text-good ${className}`}>
        <CheckCircle2 className="h-4 w-4" /> You&apos;re on the list — we&apos;ll email you when you&apos;re in.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className="omnibox flex flex-col gap-2 p-2 sm:flex-row sm:items-center">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={loading}
          className="min-w-0 flex-1 rounded-full bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-ink-dim disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading}
          className="flex shrink-0 items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          Join the waitlist
        </button>
      </div>
      <input
        type="text"
        value={niche}
        onChange={(e) => setNiche(e.target.value)}
        placeholder="What do you do? (optional — SEO, ops, e-commerce…)"
        disabled={loading}
        className="mt-2 w-full rounded-full border border-ink-line bg-ink-raised px-4 py-2 text-xs outline-none placeholder:text-ink-dim focus:border-accent disabled:opacity-60"
      />
      {error && <p className="mt-2 text-xs text-bad">{error}</p>}
    </form>
  );
}
