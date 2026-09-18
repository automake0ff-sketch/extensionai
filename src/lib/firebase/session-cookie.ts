/**
 * Kept in its own file, separate from lib/firebase/session.ts, on purpose.
 * src/proxy.ts (Next's middleware-equivalent, runs on every request in a
 * restricted runtime) needs this constant but must NEVER import anything
 * that pulls in firebase-admin — one of its transitive dependencies
 * (jwks-rsa -> jose) does a `require()` of an ES module, which fails at
 * runtime in that environment with ERR_REQUIRE_ESM. session.ts imports
 * ./admin (the actual Firebase Admin SDK), so importing SESSION_COOKIE_NAME
 * from there — even though proxy.ts never calls anything from admin.ts —
 * was enough to drag the whole SDK into the proxy's bundle and break every
 * request, including the public landing page. Keep this file dependency-free.
 */
export const SESSION_COOKIE_NAME = "__session";
