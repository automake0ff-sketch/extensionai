import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tells Next's server bundler to load these packages via Node's native
  // require()/import() at runtime instead of trying to bundle them.
  //
  // Without this, firebase-admin crashes in production (confirmed on
  // Vercel, could not reproduce with `next build && next start` in this
  // sandbox — the bundler apparently resolves it differently in the two
  // environments) with:
  //   Error [ERR_REQUIRE_ESM]: require() of ES Module .../jose/dist/webapi/
  //   index.js from .../jwks-rsa/src/utils.js not supported.
  // Root cause: firebase-admin/lib/utils/jwt.js does a plain top-level
  // `require("jwks-rsa")` the moment anything imports firebase-admin/auth
  // (lib/firebase/admin.ts does, for adminAuth()) — jwks-rsa in turn pulls
  // in `jose`'s ESM-only webapi build, which Next's bundler doesn't
  // reconcile correctly. This is a known compatibility gap between
  // firebase-admin's dependency chain and Next.js's server bundler;
  // serverExternalPackages is the documented fix — see
  // https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages
  serverExternalPackages: ["firebase-admin", "google-auth-library", "jwks-rsa", "jose"],
  async headers() {
    return [
      {
        // Applies to every route. Generated-extension code never runs here —
        // it's only ever rendered inside a sandboxed <iframe> in the preview
        // panel (see components/editor/extension-preview.tsx) — so this CSP
        // only needs to cover ExtenAI's own app shell.
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Next.js needs 'unsafe-inline'/'unsafe-eval' for its own runtime
              // and hydration; nothing in this app injects third-party scripts.
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://api.anthropic.com https://api.github.com https://api.stripe.com https://*.googleapis.com https://*.firebaseio.com",
              "frame-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
