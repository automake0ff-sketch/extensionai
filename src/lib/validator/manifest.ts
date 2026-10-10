import type { ProjectFile, ValidationIssue } from "@/lib/types";

const KNOWN_CHROME_PERMISSIONS = new Set([
  "activeTab",
  "alarms",
  "background",
  "bookmarks",
  "browsingData",
  "clipboardRead",
  "clipboardWrite",
  "contextMenus",
  "cookies",
  "declarativeContent",
  "downloads",
  "history",
  "identity",
  "idle",
  "management",
  "notifications",
  "pageCapture",
  "power",
  "printerProvider",
  "privacy",
  "proxy",
  "scripting",
  "search",
  "sessions",
  "storage",
  "system.cpu",
  "system.display",
  "system.memory",
  "system.storage",
  "tabCapture",
  "tabGroups",
  "tabs",
  "topSites",
  "tts",
  "ttsEngine",
  "unlimitedStorage",
  "webNavigation",
  "webRequest",
  "webRequestBlocking",
  // Valid MV3 permissions that were missing from this list, so the validator
  // warned "not a recognized permission" on exactly the APIs it should be
  // steering people toward: declarativeNetRequest is the MV3 way to block
  // sites (blocks before the page loads, no host_permissions needed for
  // "block" rules), and sidePanel is the side panel API.
  "sidePanel",
  "declarativeNetRequest",
  "declarativeNetRequestWithHostAccess",
  "declarativeNetRequestFeedback",
  "offscreen",
  "nativeMessaging",
  "readingList",
  "contentSettings",
  "fontSettings",
  "geolocation",
  "identity.email",
  "debugger",
  "desktopCapture",
  "gcm",
]);

// Permissions that are broad/sensitive enough to always flag as "consider
// narrowing" even though they may be legitimate (spec section 8/15).
const SENSITIVE_PERMISSIONS = new Set(["tabs", "webRequest", "webRequestBlocking", "history", "cookies", "<all_urls>"]);

export function validateManifest(manifestContent: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  let manifest: Record<string, unknown>;

  try {
    manifest = JSON.parse(manifestContent);
  } catch {
    return [
      {
        level: "error",
        code: "manifest_invalid_json",
        message: "manifest.json is not valid JSON.",
        path: "manifest.json",
      },
    ];
  }

  if (manifest.manifest_version !== 3) {
    issues.push({
      level: "error",
      code: "manifest_version",
      message: 'manifest.json must set "manifest_version": 3.',
      path: "manifest.json",
    });
  }

  if (!manifest.name || typeof manifest.name !== "string") {
    issues.push({
      level: "error",
      code: "manifest_name",
      message: "manifest.json is missing a valid \"name\".",
      path: "manifest.json",
    });
  }

  if (!manifest.version || typeof manifest.version !== "string") {
    issues.push({
      level: "error",
      code: "manifest_version_field",
      message: "manifest.json is missing a valid \"version\" string (e.g. \"1.0.0\").",
      path: "manifest.json",
    });
  }

  const permissions = Array.isArray(manifest.permissions) ? (manifest.permissions as string[]) : [];
  const hostPermissions = Array.isArray(manifest.host_permissions)
    ? (manifest.host_permissions as string[])
    : [];

  for (const permission of permissions) {
    if (!KNOWN_CHROME_PERMISSIONS.has(permission)) {
      issues.push({
        level: "warning",
        code: "unknown_permission",
        message: `Permission "${permission}" is not a recognized Chrome extension permission.`,
        path: "manifest.json",
      });
    } else if (SENSITIVE_PERMISSIONS.has(permission)) {
      issues.push({
        level: "warning",
        code: "sensitive_permission",
        message: `Permission "${permission}" may not be necessary — confirm it is actually used.`,
        path: "manifest.json",
      });
    }
  }

  if (hostPermissions.includes("<all_urls>") || hostPermissions.includes("*://*/*")) {
    issues.push({
      level: "warning",
      code: "broad_host_permission",
      message:
        "host_permissions grants access to all sites. Prefer a specific domain when possible.",
      path: "manifest.json",
    });
  }

  if (manifest.background && typeof manifest.background === "object") {
    const bg = manifest.background as Record<string, unknown>;
    if (!bg.service_worker) {
      issues.push({
        level: "error",
        code: "background_missing_service_worker",
        message: 'Manifest V3 requires background.service_worker (not background.scripts/page).',
        path: "manifest.json",
      });
    }
  }

  return issues;
}

const DANGEROUS_PATTERNS: { pattern: RegExp; code: string; message: string }[] = [
  { pattern: /\beval\s*\(/, code: "eval_usage", message: "Use of eval() is not allowed." },
  {
    pattern: /new\s+Function\s*\(/,
    code: "new_function_usage",
    message: "Use of new Function() is not allowed (equivalent to eval()).",
  },
  {
    pattern: /\bset(?:Timeout|Interval)\s*\(\s*["'`]/,
    code: "string_timer_usage",
    message:
      "setTimeout/setInterval with a string argument evaluates code like eval() and is blocked by Manifest V3's CSP. Pass a function instead.",
  },
  {
    pattern: /document\.write\s*\(/,
    code: "document_write_usage",
    message: "document.write() is discouraged and blocked by Manifest V3's default CSP in many contexts.",
  },
  {
    pattern: /(api[_-]?key|secret|password)\s*[:=]\s*["'][A-Za-z0-9_\-]{8,}["']/i,
    code: "hardcoded_secret",
    message: "A hardcoded credential-like string was found in the code.",
  },
  {
    pattern: /<script[^>]+src=["']https?:\/\//i,
    code: "remote_script",
    message: "Loading a remote script violates Manifest V3's remote-code restrictions.",
  },
];

export function scanFileForSecurityIssues(file: ProjectFile): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const { pattern, code, message } of DANGEROUS_PATTERNS) {
    if (pattern.test(file.content)) {
      issues.push({ level: "error", code, message, path: file.path });
    }
  }
  return issues;
}

/**
 * Cross-checks that every file referenced from manifest.json or from
 * <script>/<link> tags in HTML files actually exists in the project.
 */
export function validateReferencedFiles(files: ProjectFile[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const byPath = new Set(files.map((f) => f.path));
  const manifestFile = files.find((f) => f.path === "manifest.json");

  if (!manifestFile) {
    return [
      {
        level: "error",
        code: "manifest_missing",
        message: "Project has no manifest.json.",
      },
    ];
  }

  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(manifestFile.content);
  } catch {
    return issues; // Already reported by validateManifest.
  }

  const referenced = new Set<string>();

  const background = manifest.background as { service_worker?: string } | undefined;
  if (background?.service_worker) referenced.add(background.service_worker);

  const action = manifest.action as { default_popup?: string; default_icon?: unknown } | undefined;
  if (action?.default_popup) referenced.add(action.default_popup);

  // Chrome refuses to load an extension whose manifest points at a missing
  // icon, so treat icon references like any other required file.
  const collectIcons = (v: unknown) => {
    if (typeof v === "string") referenced.add(v);
    else if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.values(v as Record<string, unknown>).forEach((p) => {
        if (typeof p === "string") referenced.add(p);
      });
    }
  };
  collectIcons(manifest.icons);
  collectIcons(action?.default_icon);

  const contentScripts = Array.isArray(manifest.content_scripts)
    ? (manifest.content_scripts as { js?: string[]; css?: string[] }[])
    : [];
  for (const cs of contentScripts) {
    (cs.js ?? []).forEach((p) => referenced.add(p));
    (cs.css ?? []).forEach((p) => referenced.add(p));
  }

  const optionsPage = manifest.options_page as string | undefined;
  if (optionsPage) referenced.add(optionsPage);

  const optionsUi = manifest.options_ui as { page?: string } | undefined;
  if (optionsUi?.page) referenced.add(optionsUi.page);

  const sidePanel = manifest.side_panel as { default_path?: string } | undefined;
  if (sidePanel?.default_path) referenced.add(sidePanel.default_path);

  for (const ref of referenced) {
    if (!byPath.has(ref)) {
      issues.push({
        level: "error",
        code: "missing_referenced_file",
        message: `manifest.json references "${ref}" but that file does not exist in the project.`,
        path: ref,
      });
    }
  }

  // HTML files referencing local scripts/styles that don't exist.
  for (const file of files.filter((f) => f.path.endsWith(".html"))) {
    const matches = file.content.matchAll(/(?:src|href)=["']([^"'/][^"']*)["']/g);
    for (const match of matches) {
      const ref = match[1];
      if (/^https?:\/\//.test(ref)) continue;
      const resolved = resolveRelativePath(file.path, ref);
      if (!byPath.has(resolved)) {
        issues.push({
          level: "warning",
          code: "missing_html_reference",
          message: `${file.path} references "${ref}" but that file does not exist in the project.`,
          path: file.path,
        });
      }
    }
  }

  return issues;
}

function resolveRelativePath(fromFile: string, relative: string): string {
  const parts = fromFile.split("/").slice(0, -1);
  for (const segment of relative.split("/")) {
    if (segment === "." || segment === "") continue;
    if (segment === "..") parts.pop();
    else parts.push(segment);
  }
  return parts.join("/");
}
