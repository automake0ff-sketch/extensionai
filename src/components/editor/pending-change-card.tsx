"use client";

import { useState } from "react";
import { Check, FilePlus, FileMinus, FileEdit, Loader2, X } from "lucide-react";
import type { FileChange } from "@/lib/types";

const ACTION_ICON = { create: FilePlus, update: FileEdit, delete: FileMinus } as const;
const ACTION_COLOR = { create: "text-good", update: "text-accent", delete: "text-bad" } as const;

export function PendingChangeCard({
  message,
  changes,
  onAccept,
  onReject,
}: {
  message: string;
  changes: FileChange[];
  onAccept: () => Promise<void>;
  onReject: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null);

  return (
    <div className="mr-6 rounded-2xl border border-accent/40 bg-ink-raised p-3 text-sm">
      <p>{message}</p>
      <p className="mt-2 text-xs text-ink-dim">
        {changes.length} file{changes.length === 1 ? "" : "s"} changed
      </p>
      <ul className="mt-1.5 space-y-1">
        {changes.map((c) => {
          const Icon = ACTION_ICON[c.action];
          return (
            <li key={c.path} className="flex items-center gap-1.5 text-xs">
              <Icon className={`h-3.5 w-3.5 shrink-0 ${ACTION_COLOR[c.action]}`} />
              <span className="truncate font-[family-name:var(--font-mono)]">{c.path}</span>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex gap-2">
        <button
          onClick={async () => {
            setBusy("accept");
            await onAccept();
            setBusy(null);
          }}
          disabled={busy !== null}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-accent py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {busy === "accept" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Accept
        </button>
        <button
          onClick={async () => {
            setBusy("reject");
            await onReject();
            setBusy(null);
          }}
          disabled={busy !== null}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-ink-line py-1.5 text-xs hover:bg-ink disabled:opacity-60"
        >
          {busy === "reject" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
          Reject
        </button>
      </div>
    </div>
  );
}
