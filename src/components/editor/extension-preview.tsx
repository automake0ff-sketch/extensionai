"use client";

import { useMemo } from "react";
import type { ProjectFile } from "@/lib/types";

/**
 * Real Chrome injects a `window.chrome` object on every page (for legacy
 * reasons), but `chrome.tabs`, `chrome.scripting`, `chrome.storage`, etc. are
 * only populated inside an actual extension context. Without this shim,
 * clicking any popup button that calls one of those (e.g. `chrome.tabs
 * .query(...)`) throws "Cannot read properties of undefined (reading
 * 'query')" in the sandboxed preview iframe -- a real failure mode seen in
 * production, and confusing because it looks like the generated extension is
 * broken when it's really just that this static preview can't run real
 * extension APIs (the caption below already says as much). This stubs the
 * handful of APIs popup scripts most commonly call with harmless no-ops, so
 * buttons don't crash -- they just won't have real page data, which is the
 * best any static preview can do; loading the extension in Chrome is still
 * the only way to see it actually work.
 */
const CHROME_API_SHIM = `
<script>
(function () {
  window.chrome = window.chrome || {};
  var noop = function () {};
  var asCallback = function (value) {
    return function (cb) { if (typeof cb === "function") cb(value); return Promise.resolve(value); };
  };
  chrome.tabs = chrome.tabs || {
    query: function (opts, cb) { return asCallback([])(cb); },
    sendMessage: function (tabId, msg, opts, cb) { return asCallback(undefined)(typeof opts === "function" ? opts : cb); },
    create: noop,
    update: noop,
  };
  chrome.runtime = chrome.runtime || {
    sendMessage: function (msg, cb) { return asCallback(undefined)(cb); },
    onMessage: { addListener: noop, removeListener: noop },
    getURL: function (p) { return p; },
    id: "preview",
    lastError: undefined,
  };
  chrome.scripting = chrome.scripting || {
    executeScript: function () { return Promise.resolve([{ result: undefined }]); },
    insertCSS: function () { return Promise.resolve(); },
  };
  chrome.storage = chrome.storage || (function () {
    var mem = {};
    var api = {
      get: function (keys, cb) {
        var result = {};
        if (keys == null) result = Object.assign({}, mem);
        else if (typeof keys === "string") result[keys] = mem[keys];
        else if (Array.isArray(keys)) keys.forEach(function (k) { result[k] = mem[k]; });
        else result = Object.assign({}, keys, mem);
        return asCallback(result)(cb);
      },
      set: function (items, cb) { Object.assign(mem, items); return asCallback(undefined)(cb); },
      remove: function (keys, cb) {
        (Array.isArray(keys) ? keys : [keys]).forEach(function (k) { delete mem[k]; });
        return asCallback(undefined)(cb);
      },
      clear: function (cb) { mem = {}; return asCallback(undefined)(cb); },
    };
    return { local: api, sync: api, session: api };
  })();
  chrome.action = chrome.action || { setBadgeText: noop, setIcon: noop, setTitle: noop };
  chrome.contextMenus = chrome.contextMenus || { create: noop, removeAll: noop };

  // Anything this shim doesn't cover still throws -- but with a message
  // that explains why, instead of a bare "Cannot read properties of
  // undefined", so it's clear this is a preview limitation, not a bug in
  // the generated code.
  window.addEventListener("error", function (e) {
    if (e.message && e.message.indexOf("chrome.") === -1 && /reading '(query|sendMessage|get|set)'/.test(e.message)) {
      var note = document.createElement("div");
      note.textContent = "This button uses a Chrome extension API this static preview doesn't simulate. Load the extension in Chrome to test it for real.";
      note.style.cssText = "position:fixed;left:8px;right:8px;bottom:8px;padding:8px 10px;background:#1a1a1a;color:#e5e5e5;font:12px system-ui;border-radius:8px;z-index:9999;";
      document.body.appendChild(note);
    }
  });
})();
</script>`;

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

    return CHROME_API_SHIM + html;
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
        Static preview — renders the generated popup markup directly, with harmless stand-ins for
        common Chrome APIs (tabs, storage, messaging) so buttons don&apos;t crash. They don&apos;t
        return real page data. Background/content-script behavior on real pages can only be
        confirmed by loading the extension in Chrome.
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
