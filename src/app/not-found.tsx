import Link from "next/link";
import { ExtenAIMark } from "@/components/brand/mark";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <ExtenAIMark className="h-8 w-8 text-accent" />
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-dim">
        The page you&apos;re looking for doesn&apos;t exist, or you may not have access to it.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
