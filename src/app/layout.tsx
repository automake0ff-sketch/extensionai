import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ExtenAI — Build Chrome extensions with AI",
  description:
    "Describe the browser extension you want in plain English and get a working Manifest V3 Chrome extension you can edit by chatting and download as a ZIP.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // translate="no" (html) + notranslate (body): opt the whole app out of
    // the browser's built-in page translator. This is app UI chrome, not
    // article content, and Chrome's translator rewriting text nodes outside
    // React's control caused real crashes here -- confirmed via a browser
    // console trace: the translator's stylesheet load was visibly blocked by
    // our CSP, and the very next React re-render threw "Failed to execute
    // insertBefore on Node: ... not a child of this node", straight to the
    // error boundary. It first surfaced on /login (fixed there in isolation);
    // it then hit /projects/new the same way, which is why this is now on
    // <html>/<body> instead of one more component at a time.
    <html lang="en" translate="no" className="h-full antialiased">
      <body className="notranslate min-h-full flex flex-col bg-ink text-ink-100">{children}</body>
    </html>
  );
}
