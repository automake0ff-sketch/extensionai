"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ background: "#0f1115", color: "#ecead4", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "24px", textAlign: "center" }}>
          <h1 style={{ fontSize: "24px", fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ marginTop: "8px", maxWidth: "360px", color: "#8b909b", fontSize: "14px" }}>
            ExtenAI hit an unexpected error loading the app. Please try again.
          </p>
          <button
            onClick={reset}
            style={{ marginTop: "24px", borderRadius: "9999px", background: "#5b7fff", color: "white", padding: "10px 20px", fontSize: "14px", fontWeight: 500, border: "none", cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
