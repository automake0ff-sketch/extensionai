"use client";

import { useEffect } from "react";
import { ExtenAIMark } from "@/components/brand/mark";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Server-side error reporting hook — wire a real error tracker
    // (Sentry, etc.) here when one is configured. Never surface `error`
    // itself to the person (see spec section 23 / SECURITY.md).
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <ExtenAIMark className="h-8 w-8 text-bad" />
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-dim">
        We hit an unexpected error. Please try again — if it keeps happening,
        let us know at [support email].
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}
