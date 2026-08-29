import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ExtenAI — Build Chrome extensions with AI",
  description:
    "Describe the browser extension you want in plain English and get a working Manifest V3 Chrome extension you can edit by chatting and download as a ZIP.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-ink text-ink-100">{children}</body>
    </html>
  );
}
