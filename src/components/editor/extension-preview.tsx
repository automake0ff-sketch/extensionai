"use client";

import { useMemo } from "react";
import type { ProjectFile } from "@/lib/types";

/**
 * Spec section 13: this is explicitly a *preview*, not a real running
 * extension. It renders the popup's actual HTML/CSS in a sandboxed iframe
 * (so what you see is the real markup, not a mockup) and shows the parsed
 * manifest structure alongside it. It never claims to be a live Chrome
 * extension instance.
 */
export function ExtensionPreview({
  popupFile,
  files,
  manifestFile,
}: {
  popupFile?: ProjectFile;
  files: ProjectFile[];
  manifestFile?: ProjectFile;
}) {
  const srcDoc = useMemo(() => {
    if (!popupFile) return null;
    let html = popupFile.content;

    // Inline any local <link rel="stylesheet"> / <script src> referenced from
    // the popup's own directory, so the sandboxed iframe (which has no access
    // to the other project files) still renders with real styles/behavior.
    const dir = popupFile.path.split("/").slice(0, -1).join("/");
    const resolve = (rel: string) => (dir ? `${dir}/${rel}`.replace(/\/\.\//g, "/") : rel);

    html = html.replace(/<link[^>]+href=["']([^"'/][^"']*)["'][^>]*>/g, (match, href) => {
      const file = files.find((f) => f.path === resolve(href));
      return file ? `<style>${file.content}</style>` : match;
    });

    html = html.replace(/<script[^>]+src=["']([^"'/][^"']*)["'][^>]*><\/script>/g, (match, src) => {
      const file = files.find((f) => f.path === resolve(src));
      return file ? `<script>${file.content}</script>` : match;
    });

    return html;
  }, [popupFile, files]);

  let manifest: Record<string, unknown> | null = null;
  try {
    if (manifestFile) manifest = JSON.parse(manifestFile.content);
  } catch {
    manifest = null;
  }

  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-ink-line bg-ink-raised px-3 py-2 text-xs text-ink-dim">
        Static preview — renders the generated popup markup directly. Background/content-script
        behavior on real pages can only be confirmed by loading the extension in Chrome.
      </p>

      {popupFile ? (
        <div>
          <p className="mb-1 text-xs text-ink-dim">Popup ({popupFile.path})</p>
          <iframe
            title="Extension popup preview"
            srcDoc={srcDoc ?? ""}
            sandbox="allow-scripts"
            className="h-56 w-full rounded-xl border border-ink-line bg-white"
          />
        </div>
      ) : (
        <p className="text-sm text-ink-dim">No popup.html in this project yet.</p>
      )}

      {manifest ? (
        <div>
          <p className="mb-1 text-xs text-ink-dim">Manifest summary</p>
          <div className="space-y-1 rounded-xl border border-ink-line bg-ink-raised p-3 text-xs">
            <Row label="Name" value={String(manifest.name ?? "—")} />
            <Row label="Version" value={String(manifest.version ?? "—")} />
            <Row label="Manifest version" value={String(manifest.manifest_version ?? "—")} />
            <Row
              label="Permissions"
              value={Array.isArray(manifest.permissions) && manifest.permissions.length ? manifest.permissions.join(", ") : "none"}
            />
            <Row
              label="Host permissions"
              value={
                Array.isArray(manifest.host_permissions) && manifest.host_permissions.length
                  ? manifest.host_permissions.join(", ")
                  : "none"
              }
            />
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink-dim">No manifest.json parsed yet.</p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-ink-dim">{label}</span>
      <span className="truncate text-right">{value}</span>
    </div>
  );
}
