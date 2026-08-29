"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { GithubMark } from "@/components/brand/github-mark";

export function GithubConnectionCard({ githubLogin }: { githubLogin: string | null }) {
  const [disconnecting, setDisconnecting] = useState(false);
  const router = useRouter();

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await fetch("/api/github/disconnect", { method: "POST" });
      router.refresh();
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <section className="mt-4 rounded-2xl border border-ink-line bg-ink-raised p-5">
      <h2 className="flex items-center gap-2 text-sm font-medium">
        <GithubMark className="h-4 w-4" /> GitHub
      </h2>
      {githubLogin ? (
        <>
          <p className="mt-2 text-sm text-ink-dim">
            Connected as <span className="text-ink-100">@{githubLogin}</span>. You can export any
            project to a new repository from its workspace page.
          </p>
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="mt-3 flex items-center gap-2 rounded-full border border-ink-line px-4 py-2 text-sm text-ink-dim hover:bg-ink disabled:opacity-60"
          >
            {disconnecting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Disconnect GitHub
          </button>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-ink-dim">
            Connect GitHub to export a project straight to a new repository, as a single commit,
            instead of downloading and pushing the ZIP yourself.
          </p>
          <a
            href="/api/github/connect"
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <GithubMark className="h-4 w-4" /> Connect GitHub
          </a>
        </>
      )}
    </section>
  );
}
