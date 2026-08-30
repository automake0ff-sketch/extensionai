"use client";

import { diffLines } from "diff";
import { useMemo } from "react";

const MAX_DIFF_LINES = 300;

export function FileDiffView({
  action,
  oldContent,
  newContent,
}: {
  action: "create" | "update" | "delete";
  oldContent: string;
  newContent: string;
}) {
  const lines = useMemo(() => {
    if (action === "create") {
      return newContent.split("\n").map((line) => ({ type: "add" as const, line }));
    }
    if (action === "delete") {
      return oldContent.split("\n").map((line) => ({ type: "remove" as const, line }));
    }

    const parts = diffLines(oldContent, newContent);
    const out: { type: "add" | "remove" | "context"; line: string }[] = [];
    for (const part of parts) {
      const partLines = part.value.replace(/\n$/, "").split("\n");
      const type = part.added ? "add" : part.removed ? "remove" : "context";
      for (const line of partLines) out.push({ type, line });
    }
    return out;
  }, [action, oldContent, newContent]);

  const truncated = lines.length > MAX_DIFF_LINES;
  const visible = truncated ? lines.slice(0, MAX_DIFF_LINES) : lines;

  return (
    <div className="max-h-64 overflow-auto rounded-lg border border-ink-line bg-ink font-[family-name:var(--font-mono)] text-[11px] leading-relaxed">
      {visible.map((entry, i) => (
        <div
          key={i}
          className={
            entry.type === "add"
              ? "bg-good/10 text-good"
              : entry.type === "remove"
                ? "bg-bad/10 text-bad"
                : "text-ink-dim"
          }
        >
          <span className="select-none pl-2 pr-2 opacity-60">
            {entry.type === "add" ? "+" : entry.type === "remove" ? "-" : " "}
          </span>
          <span className="whitespace-pre-wrap break-all">{entry.line || " "}</span>
        </div>
      ))}
      {truncated && (
        <div className="px-2 py-1 text-ink-dim">… {lines.length - MAX_DIFF_LINES} more lines not shown</div>
      )}
    </div>
  );
}
