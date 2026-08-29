"use client";

import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { clientAuth } from "@/lib/firebase/client";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await signOut(clientAuth);
    await fetch("/api/auth/session", { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-dim hover:bg-ink hover:text-ink-100"
    >
      <LogOut className="h-4 w-4" /> Sign out
    </button>
  );
}
