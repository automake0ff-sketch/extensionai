import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tells Next's server bundler to load these packages via Node's native
  // require()/import() at runtime instead of trying to bundle them.
  //
  // ROOT CAUSE (confirmed via real Vercel Runtime Logs, still crashing as
  // of 2026-09-25 on /api/auth/session, /api/waitlist, /api/projects, two
  // days after switching the build to webpack):
  //   Error [ERR_REQUIRE_ESM]: require() of ES Module .../jose/dist/webapi/
  //   index.js from .../jwks-rsa/src/utils.js not supported.
  // This is NOT a bundler issue — forcing `next build --webpack` (see
  // package.json) did not fix it, because serverExternalPackages makes
  // Next skip bundling these packages entirely, so they're loaded via
  // Node's own require() straight from node_modules in the Lambda,
  // regardless of webpack vs. turbopack. firebase-admin/lib/utils/jwt.js
  // does an unconditional top-level `require("jwks-rsa")` the moment
  // anything touches firebase-admin/auth (adminAuth() in
  // lib/firebase/admin.ts does), and jwks-rsa@4.x depends on jose@^6,
  // which ships as pure ESM ("type": "module", no CJS build, no "require"
  // export condition at all) — so `require("jose")` inside jwks-rsa is
  // structurally impossible to satisfy under plain Node require(), in any
  // bundler. The actual fix is the "overrides" entry in package.json,
  // pinning `jose` to the last version with a real CJS build (4.15.9) so
  // jwks-rsa's require() resolves to something requirable. Don't remove
  // that override thinking this serverExternalPackages entry alone is
  // enough — it isn't, and this bug has already resurfaced once from that
  // exact assumption.
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
