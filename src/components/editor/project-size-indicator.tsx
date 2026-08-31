"use client";

import { useMemo } from "react";
import { getProjectSizeSummary } from "@/lib/limits";
import type { ProjectFile } from "@/lib/types";

export function ProjectSizeIndicator({ files }: { files: ProjectFile[] }) {
  const summary = useMemo(() => getProjectSizeSummary(files), [files]);
  const fileRatio = summary.fileCount / summary.maxFiles;
  const byteRatio = summary.totalBytes / summary.maxTotalBytes;
  const nearLimit = fileRatio > 0.8 || byteRatio > 0.8;

  return (
    <span
      className={`hidden shrink-0 items-center gap-1 text-[11px] sm:flex ${nearLimit ? "text-warn" : "text-ink-dim"}`}
      title={`${summary.fileCount}/${summary.maxFiles} files · ${Math.round(summary.totalBytes / 1024)}/${Math.round(
        summary.maxTotalBytes / 1024
      )} KB`}
    >
      {summary.fileCount}/{summary.maxFiles} files · {Math.round(summary.totalBytes / 1024)} KB
    </span>
  );
}
