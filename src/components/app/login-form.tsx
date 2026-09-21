"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { clientAuth, githubProvider, googleProvider } from "@/lib/firebase/client";
import { ExtenAIMark } from "@/components/brand/mark";
import { Loader2 } from "lucide-react";

type Mode = "sign_in" | "sign_up";

async function establishServerSession(idToken: string) {
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) throw new Error("Could not establish a session.");
}

export function LoginForm() {
  const [mode, setMode] = useState<Mode>("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/dashboard";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === "sign_in") {
        const credential = await signInWithEmailAndPassword(clientAuth, email, password);
        const idToken = await credential.user.getIdToken();
        await establishServerSession(idToken);
      } else {
        const credential = await createUserWithEmailAndPassword(clientAuth, email, password);
        sendEmailVerification(credential.user).catch(() => {
          // Non-blocking — verification email is a nice-to-have, not a gate.
        });
        const idToken = await credential.user.getIdToken();
        await establishServerSession(idToken);
      }
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (mode === "sign_up" && code === "auth/email-already-in-use") {
        setError("That email already has an account. Try logging in instead.");
        setMode("sign_in");
      } else {
        setError(
          mode === "sign_in"
            ? "We couldn't sign you in. Check your email and password and try again."
            : "We couldn't create your account. Please try a different email or a stronger password."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider: "github" | "google") {
    setError(null);
    try {
      const credential = await signInWithPopup(clientAuth, provider === "github" ? githubProvider : googleProvider);
      const idToken = await credential.user.getIdToken();
      await establishServerSession(idToken);
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("We couldn't sign you in with that provider. Please try again.");
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <ExtenAIMark className="h-6 w-6 text-accent" />
          <span className="font-[family-name:var(--font-display)] text-lg font-semibold">ExtenAI</span>
        </Link>

        <div className="rounded-2xl border border-ink-line bg-ink-raised p-6">
          <h1 className="text-lg font-semibold">
            {mode === "sign_in" ? "Log in" : "Create your account"}
          </h1>

          <div className="mt-5 space-y-2">
            <button
              type="button"
              onClick={() => handleOAuth("github")}
              className="w-full rounded-full border border-ink-line py-2.5 text-sm hover:bg-ink"
            >
              Continue with GitHub
            </button>
            <button
              type="button"
              onClick={() => handleOAuth("google")}
              className="w-full rounded-full border border-ink-line py-2.5 text-sm hover:bg-ink"
            >
              Continue with Google
            </button>
          </div>

          <div className="my-5 flex items-center gap-3 text-xs text-ink-dim">
            <div className="h-px flex-1 bg-ink-line" /> or <div className="h-px flex-1 bg-ink-line" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label htmlFor="email" className="mb-1 block text-xs text-ink-dim">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-ink-line bg-ink px-3 py-2 text-sm outline-none focus:border-accent"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-xs text-ink-dim">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-ink-line bg-ink px-3 py-2 text-sm outline-none focus:border-accent"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-sm text-bad">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "sign_in" ? "Log in" : "Sign up"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-ink-dim">
            {mode === "sign_in" ? "New here?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "sign_in" ? "sign_up" : "sign_in")}
              className="text-accent hover:underline"
            >
              {mode === "sign_in" ? "Create an account" : "Log in"}
            </button>
          </p>

          {mode === "sign_up" && (
            <p className="mt-3 text-center text-xs text-ink-dim">
              By creating an account you agree to our{" "}
              <Link href="/terms" className="text-accent hover:underline">Terms</Link> and{" "}
              <Link href="/privacy" className="text-accent hover:underline">Privacy Policy</Link>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
