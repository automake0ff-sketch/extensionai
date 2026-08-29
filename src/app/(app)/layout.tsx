import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/firebase/session";
import { ExtenAIMark } from "@/components/brand/mark";
import { SignOutButton } from "@/components/app/sign-out-button";
import { LayoutDashboard, Plus, Settings } from "lucide-react";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-1">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-ink-line bg-ink-raised/60 sm:flex">
        <Link href="/dashboard" className="flex items-center gap-2 px-5 py-5">
          <ExtenAIMark className="h-5 w-5 text-accent" />
          <span className="font-[family-name:var(--font-display)] font-semibold">ExtenAI</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-dim hover:bg-ink hover:text-ink-100"
          >
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </Link>
          <Link
            href="/projects/new"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-dim hover:bg-ink hover:text-ink-100"
          >
            <Plus className="h-4 w-4" /> New extension
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-dim hover:bg-ink hover:text-ink-100"
          >
            <Settings className="h-4 w-4" /> Settings
          </Link>
        </nav>
        <div className="border-t border-ink-line px-3 py-3">
          <p className="truncate px-3 text-xs text-ink-dim">{session.email}</p>
          <SignOutButton />
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
