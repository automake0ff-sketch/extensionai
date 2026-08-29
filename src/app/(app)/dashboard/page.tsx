import Link from "next/link";
import { getSession } from "@/lib/firebase/session";
import { getProfile, listProjects } from "@/lib/firebase/firestore";
import { getUsage } from "@/lib/usage";
import { Plus, FolderKanban, Zap } from "lucide-react";
import type { Project } from "@/lib/types";

const STATUS_LABEL: Record<Project["status"], { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-ink-line text-ink-dim" },
  generating: { label: "Generating…", className: "bg-warn/20 text-warn" },
  ready: { label: "Ready", className: "bg-good/20 text-good" },
  error: { label: "Needs attention", className: "bg-bad/20 text-bad" },
};

export default async function DashboardPage() {
  const session = await getSession();
  const profile = await getProfile(session!.uid);
  const usage = await getUsage(session!.uid, profile?.plan ?? "free");
  const projects = await listProjects(session!.uid);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Dashboard</h1>
        <Link
          href="/projects/new"
          className="flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New extension
        </Link>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-ink-line bg-ink-raised p-5">
          <div className="flex items-center gap-2 text-ink-dim">
            <FolderKanban className="h-4 w-4" /> <span className="text-xs">Projects</span>
          </div>
          <p className="mt-2 text-2xl font-semibold">{projects.length}</p>
        </div>
        <div className="rounded-2xl border border-ink-line bg-ink-raised p-5">
          <div className="flex items-center gap-2 text-ink-dim">
            <Zap className="h-4 w-4" /> <span className="text-xs">AI credits used this period</span>
          </div>
          <p className="mt-2 text-2xl font-semibold">
            {usage.used} <span className="text-base font-normal text-ink-dim">/ {usage.limit}</span>
          </p>
        </div>
        <div className="rounded-2xl border border-ink-line bg-ink-raised p-5">
          <div className="flex items-center gap-2 text-ink-dim">
            <span className="text-xs">Plan</span>
          </div>
          <p className="mt-2 text-2xl font-semibold capitalize">{(profile?.plan ?? "free").replace("_", "+")}</p>
        </div>
      </div>

      <h2 className="mt-10 mb-4 text-sm font-medium text-ink-dim">Recent projects</h2>
      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-line p-10 text-center text-ink-dim">
          <p>You haven&apos;t built anything yet.</p>
          <Link href="/projects/new" className="mt-3 inline-block text-accent hover:underline">
            Create your first extension →
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const status = STATUS_LABEL[project.status];
            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="rounded-2xl border border-ink-line bg-ink-raised p-4 hover:border-accent"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{project.name}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${status.className}`}>{status.label}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-ink-dim">
                  {project.description || "No description yet."}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
