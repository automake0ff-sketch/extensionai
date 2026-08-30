"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import CodeEditor from "@uiw/react-textarea-code-editor";
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  File as FileIcon,
  FileCode,
  FileJson,
  FileText,
  Loader2,
  ShieldCheck,
  Sparkles,
  Send,
} from "lucide-react";
import { GithubMark } from "@/components/brand/github-mark";
import type { ChatMessage, FileChange, Project, ProjectFile, ValidationResult } from "@/lib/types";
import { ExtensionPreview } from "./extension-preview";
import { StorePrepPanel } from "./store-prep-panel";
import { TestPlanPanel } from "./test-plan-panel";
import { FileHistoryPanel } from "./file-history-panel";
import { PendingChangeCard } from "./pending-change-card";
import { GithubExportModal } from "./github-export-modal";

type Tab = "preview" | "validate" | "tests" | "store";

interface PendingChange {
  generationId: string;
  message: string;
  changes: FileChange[];
}

function languageFor(path: string): string {
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".ts") || path.endsWith(".tsx")) return "ts";
  if (path.endsWith(".js") || path.endsWith(".jsx")) return "js";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".md")) return "markdown";
  return "text";
}

function iconFor(path: string) {
  if (path.endsWith(".json")) return FileJson;
  if (path.endsWith(".md")) return FileText;
  if (path.endsWith(".js") || path.endsWith(".ts") || path.endsWith(".jsx") || path.endsWith(".tsx")) return FileCode;
  return FileIcon;
}

export function ProjectWorkspace({
  project,
  initialFiles,
  initialMessages,
}: {
  project: Project;
  initialFiles: ProjectFile[];
  initialMessages: ChatMessage[];
}) {
  const [files, setFiles] = useState<ProjectFile[]>(initialFiles);
  const [selectedPath, setSelectedPath] = useState<string | null>(initialFiles[0]?.path ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const [dirtyContent, setDirtyContent] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>("preview");
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportConfirm, setExportConfirm] = useState<ValidationResult | null>(null);
  const [lastChangedPaths, setLastChangedPaths] = useState<string[]>([]);
  const [showGithubModal, setShowGithubModal] = useState(false);

  const selectedFile = useMemo(() => files.find((f) => f.path === selectedPath) ?? null, [files, selectedPath]);
  const displayedContent = dirtyContent !== null ? dirtyContent : selectedFile?.content ?? "";

  const sortedFiles = useMemo(() => [...files].sort((a, b) => a.path.localeCompare(b.path)), [files]);

  async function handleSaveFile() {
    if (!selectedFile || dirtyContent === null) return;
    setSaving(true);
    try {
      await fetch("/api/files", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, path: selectedFile.path, content: dirtyContent }),
      });
      setFiles((prev) => prev.map((f) => (f.path === selectedFile.path ? { ...f, content: dirtyContent } : f)));
      setDirtyContent(null);
    } finally {
      setSaving(false);
    }
  }

  function handleFileRestored(path: string, content: string) {
    setFiles((prev) => prev.map((f) => (f.path === path ? { ...f, content } : f)));
    if (selectedPath === path) setDirtyContent(null);
  }

  async function handleSendMessage() {
    if (!chatInput.trim() || chatLoading || pendingChange) return;
    const userMessage = chatInput;
    setChatInput("");
    setChatError(null);
    setChatLoading(true);

    setMessages((prev) => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        project_id: project.id,
        user_id: project.user_id,
        role: "user",
        content: userMessage,
        created_at: new Date().toISOString(),
      },
    ]);

    try {
      const res = await fetch("/api/modify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, message: userMessage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "We couldn't propose that change.");

      // The change is NOT applied yet — it waits for Accept/Reject (spec section 11).
      setPendingChange({
        generationId: data.generationId,
        message: data.result.message,
        changes: data.result.changes,
      });
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setChatLoading(false);
    }
  }

  async function handleAcceptChange() {
    if (!pendingChange) return;
    try {
      const res = await fetch("/api/modify/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, generationId: pendingChange.generationId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "We couldn't apply that change.");

      setLastChangedPaths(pendingChange.changes.map((c) => c.path));
      setFiles(data.files as ProjectFile[]);
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          project_id: project.id,
          user_id: project.user_id,
          role: "assistant",
          content: pendingChange.message,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPendingChange(null);
    }
  }

  async function handleRejectChange() {
    if (!pendingChange) return;
    try {
      await fetch("/api/modify/discard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, generationId: pendingChange.generationId }),
      });
    } finally {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          project_id: project.id,
          user_id: project.user_id,
          role: "assistant",
          content: "Discarded — no files were changed.",
          created_at: new Date().toISOString(),
        },
      ]);
      setPendingChange(null);
    }
  }

  function handleTabChange(nextTab: Tab) {
    if (nextTab === "preview" && tab !== "preview") {
      fetch("/api/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "preview_opened", projectId: project.id }),
      }).catch(() => {
        // Analytics must never interrupt navigation.
      });
    }
    setTab(nextTab);
  }

  async function handleValidate() {
    setValidating(true);
    setTab("validate");
    try {
      const res = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id }),
      });
      const data = await res.json();
      if (res.ok) setValidation(data.result);
    } finally {
      setValidating(false);
    }
  }

  async function downloadZip(force: boolean) {
    setExporting(true);
    try {
      const res = await fetch(`/api/export?projectId=${project.id}${force ? "&force=true" : ""}`);
      if (res.status === 409) {
        const data = await res.json();
        setExportConfirm(data.validation);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "We couldn't export this project.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setExportConfirm(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  const popupFile = files.find((f) => f.path.match(/popup\.html$/));
  const manifestFile = files.find((f) => f.path === "manifest.json");

  return (
    <div className="flex h-screen flex-1 flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-ink-line px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/dashboard" className="text-ink-dim hover:text-ink-100">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-medium">{project.name}</h1>
            <p className="truncate text-xs text-ink-dim">{project.status}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleValidate}
            className="flex items-center gap-1.5 rounded-full border border-ink-line px-3 py-1.5 text-xs hover:bg-ink-raised"
          >
            <ShieldCheck className="h-3.5 w-3.5" /> Validate
          </button>
          <button
            onClick={() => setShowGithubModal(true)}
            className="flex items-center gap-1.5 rounded-full border border-ink-line px-3 py-1.5 text-xs hover:bg-ink-raised"
          >
            <GithubMark className="h-3.5 w-3.5" /> Export to GitHub
          </button>
          <button
            onClick={() => downloadZip(false)}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Download ZIP
          </button>
        </div>
      </div>

      {showGithubModal && (
        <GithubExportModal
          projectId={project.id}
          defaultRepoName={project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}
          onClose={() => setShowGithubModal(false)}
        />
      )}

      {exportConfirm && (
        <div className="border-b border-warn/40 bg-warn/10 px-4 py-3 text-xs">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
            <div className="flex-1">
              <p className="font-medium text-warn">
                This extension has {exportConfirm.issues.filter((i) => i.level === "error").length} validation
                error(s). Exporting now may produce a ZIP that Chrome refuses to load.
              </p>
              <ul className="mt-1 space-y-0.5 text-ink-dim">
                {exportConfirm.issues
                  .filter((i) => i.level === "error")
                  .map((i, idx) => (
                    <li key={idx}>• {i.message}</li>
                  ))}
              </ul>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => downloadZip(true)}
                  className="rounded-full border border-warn/60 px-3 py-1 text-warn hover:bg-warn/10"
                >
                  Export anyway
                </button>
                <button onClick={() => setExportConfirm(null)} className="rounded-full px-3 py-1 hover:bg-ink">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* File tree */}
        <div className="w-56 shrink-0 overflow-y-auto border-r border-ink-line bg-ink-raised/40 p-2">
          <p className="px-2 py-1 text-xs uppercase tracking-wide text-ink-dim">Files</p>
          {sortedFiles.length === 0 && <p className="px-2 py-2 text-xs text-ink-dim">No files yet.</p>}
          {sortedFiles.map((file) => {
            const Icon = iconFor(file.path);
            const changed = lastChangedPaths.includes(file.path);
            return (
              <button
                key={file.path}
                onClick={() => {
                  setSelectedPath(file.path);
                  setDirtyContent(null);
                }}
                className={`flex w-full items-center gap-2 truncate rounded-lg px-2 py-1.5 text-left text-xs ${
                  selectedPath === file.path ? "bg-accent-dim text-ink-100" : "text-ink-dim hover:bg-ink"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{file.path}</span>
                {changed && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-good" />}
              </button>
            );
          })}
        </div>

        {/* Editor */}
        <div className="flex min-w-0 flex-1 flex-col border-r border-ink-line">
          <div className="flex items-center justify-between border-b border-ink-line px-4 py-2">
            <span className="font-[family-name:var(--font-mono)] text-xs text-ink-dim">
              {selectedFile?.path ?? "Select a file"}
            </span>
            <div className="flex items-center gap-2">
              {dirtyContent !== null && (
                <button
                  onClick={handleSaveFile}
                  disabled={saving}
                  className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-white hover:opacity-90"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              )}
              {selectedFile && (
                <FileHistoryPanel
                  key={selectedFile.path}
                  projectId={project.id}
                  path={selectedFile.path}
                  onRestored={handleFileRestored}
                />
              )}
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            {selectedFile ? (
              <CodeEditor
                value={displayedContent}
                language={languageFor(selectedFile.path)}
                onChange={(e) => setDirtyContent(e.target.value)}
                padding={16}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  minHeight: "100%",
                  backgroundColor: "var(--ink)",
                  color: "var(--paper)",
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-ink-dim">
                No file selected yet — ask the AI to generate one below.
              </div>
            )}
          </div>
        </div>

        {/* Right: preview / validate / tests / store tabs */}
        <div className="flex w-96 shrink-0 flex-col border-r border-ink-line">
          <div className="flex border-b border-ink-line text-xs">
            {[
              { id: "preview" as Tab, label: "Preview" },
              { id: "validate" as Tab, label: "Health" },
              { id: "tests" as Tab, label: "Tests" },
              { id: "store" as Tab, label: "Store" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => handleTabChange(t.id)}
                className={`flex-1 py-2.5 ${tab === t.id ? "border-b-2 border-accent text-ink-100" : "text-ink-dim"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {tab === "preview" && <ExtensionPreview popupFile={popupFile} files={files} manifestFile={manifestFile} />}
            {tab === "validate" && (
              <ValidationPanel validation={validation} validating={validating} onRevalidate={handleValidate} />
            )}
            {tab === "tests" && <TestPlanPanel projectId={project.id} />}
            {tab === "store" && <StorePrepPanel projectId={project.id} />}
          </div>
        </div>

        {/* Chat */}
        <div className="flex w-80 shrink-0 flex-col">
          <div className="border-b border-ink-line px-4 py-2 text-xs uppercase tracking-wide text-ink-dim">
            AI Assistant
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && !pendingChange && (
              <p className="text-sm text-ink-dim">Ask for changes, e.g. &ldquo;Add dark mode.&rdquo;</p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-2xl px-3 py-2 text-sm ${
                  m.role === "user" ? "ml-6 bg-accent-dim" : "mr-6 bg-ink-raised"
                }`}
              >
                {m.content}
              </div>
            ))}
            {chatLoading && (
              <div className="mr-6 flex items-center gap-2 rounded-2xl bg-ink-raised px-3 py-2 text-sm text-ink-dim">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
              </div>
            )}
            {pendingChange && (
              <PendingChangeCard
                message={pendingChange.message}
                changes={pendingChange.changes}
                originalFiles={files}
                onAccept={handleAcceptChange}
                onReject={handleRejectChange}
              />
            )}
            {chatError && <p className="text-sm text-bad">{chatError}</p>}
          </div>
          <div className="border-t border-ink-line p-3">
            <div className="omnibox flex items-center gap-2 px-3 py-2">
              <Sparkles className="h-4 w-4 shrink-0 text-accent" />
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder={pendingChange ? "Resolve the pending change above first" : "What would you like to change?"}
                disabled={chatLoading || !!pendingChange}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-dim disabled:opacity-60"
              />
              <button
                onClick={handleSendMessage}
                disabled={chatLoading || !!pendingChange || !chatInput.trim()}
                className="text-accent disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ValidationPanel({
  validation,
  validating,
  onRevalidate,
}: {
  validation: ValidationResult | null;
  validating: boolean;
  onRevalidate: () => void;
}) {
  if (validating) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-dim">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking manifest, files, and security…
      </div>
    );
  }

  if (!validation) {
    return (
      <div className="text-sm text-ink-dim">
        <p>Run the validator to check manifest correctness, broken references, and risky code patterns.</p>
        <button onClick={onRevalidate} className="mt-3 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-white">
          Run validation
        </button>
      </div>
    );
  }

  const errors = validation.issues.filter((i) => i.level === "error");
  const warnings = validation.issues.filter((i) => i.level === "warning");

  return (
    <div className="space-y-3 text-sm">
      <p className={`font-medium ${validation.valid ? "text-good" : "text-bad"}`}>
        {validation.valid ? "Extension health: passing" : "Extension health: needs fixes"}
      </p>
      {errors.map((issue, i) => (
        <div key={`e-${i}`} className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-xs">
          <span className="text-bad">✕ {issue.message}</span>
          {issue.path && <p className="mt-0.5 text-ink-dim">{issue.path}</p>}
        </div>
      ))}
      {warnings.map((issue, i) => (
        <div key={`w-${i}`} className="rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-xs">
          <span className="text-warn">⚠ {issue.message}</span>
          {issue.path && <p className="mt-0.5 text-ink-dim">{issue.path}</p>}
        </div>
      ))}
      {errors.length === 0 && warnings.length === 0 && (
        <p className="text-ink-dim">No issues found. ✓ Manifest valid · ✓ Files valid · ✓ No secrets detected</p>
      )}
      <button onClick={onRevalidate} className="mt-2 text-xs text-accent hover:underline">
        Re-run validation
      </button>
    </div>
  );
}
