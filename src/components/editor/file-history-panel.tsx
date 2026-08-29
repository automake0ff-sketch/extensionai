"use client";

import { useState } from "react";
import { History, Loader2, RotateCcw } from "lucide-react";
import type { FileVersion } from "@/lib/types";

export function FileHistoryPanel({
  projectId,
  path,
  onRestored,
}: {
  projectId: string;
  path: string;
  onRestored: (path: string, content: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<FileVersion[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  async function handleToggle() {
    if (!open && versions === null) {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/files/versions?projectId=${encodeURIComponent(projectId)}&path=${encodeURIComponent(path)}`
        );
        const data = await res.json();
        setVersions(res.ok ? data.versions : []);
      } finally {
        setLoading(false);
      }
    }
    setOpen((o) => !o);
  }

  async function handleRestore(versionId: string) {
    setRestoringId(versionId);
    try {
      const res = await fetch("/api/files/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, versionId }),
      });
      const data = await res.json();
      if (res.ok) {
        onRestored(data.path, data.content);
        setVersions(null);
        setOpen(false);
      }
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        className="flex items-center gap-1.5 rounded-full border border-ink-line px-2.5 py-1 text-xs text-ink-dim hover:bg-ink-raised"
      >
        <History className="h-3.5 w-3.5" /> History
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-10 w-72 rounded-xl border border-ink-line bg-ink-raised p-2 shadow-lg">
          {loading && (
            <div className="flex items-center gap-2 px-2 py-2 text-xs text-ink-dim">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading versions…
            </div>
          )}
          {!loading && versions !== null && versions.length === 0 && (
            <p className="px-2 py-2 text-xs text-ink-dim">No previous versions of this file yet.</p>
          )}
          {!loading &&
            versions?.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-ink"
              >
                <div className="min-w-0">
                  <p>
                    v{v.version_number} · {v.created_by === "ai" ? "AI edit" : "Manual edit"}
                  </p>
                  <p className="truncate text-ink-dim">{new Date(v.created_at).toLocaleString()}</p>
                </div>
                <button
                  onClick={() => handleRestore(v.id)}
                  disabled={restoringId === v.id}
                  className="flex shrink-0 items-center gap-1 rounded-full border border-ink-line px-2 py-1 text-[11px] hover:bg-ink-raised disabled:opacity-50"
                >
                  {restoringId === v.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3 w-3" />
                  )}
                  Restore
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
