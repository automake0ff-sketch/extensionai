import type { ValidationIssue } from "@/lib/types";

/** The only two fields any validator here reads, so AI output ({path, content}) and stored ProjectFiles both fit. */
export type FileLike = { path: string; content: string };

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

/**
 * Manifest shapes that make Chrome refuse to load the whole extension (or the
 * Web Store reject it), so the user only finds out by loading the unpacked
 * folder. Reported in production as "Not a valid tree for key description".
 * Each is an error except the description length, which only the Web Store
 * enforces.
 */
function validateLoadability(manifest: Record<string, unknown>, rawContent: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const error = (code: string, message: string) =>
    issues.push({ level: "error", code, message, path: "manifest.json" });

  if (manifest.description !== undefined) {
    if (typeof manifest.description !== "string") {
      error("manifest_description_invalid", '"description" must be a plain string, not an object or list.');
    } else if (manifest.description.length > 132) {
      issues.push({
        level: "warning",
        code: "manifest_description_long",
        message: `"description" is ${manifest.description.length} characters; the Chrome Web Store limits it to 132.`,
        path: "manifest.json",
      });
    }
  }

  if (typeof manifest.version === "string") {
    const parts = manifest.version.split(".");
    const validShape = /^\d+(\.\d+){0,3}$/.test(manifest.version) && parts.every((p) => Number(p) <= 65535);
    if (!validShape) {
      error(
        "manifest_version_format",
        `"version" must be 1 to 4 dot-separated numbers (each up to 65535), like "1.0.0"; "${manifest.version}" is not valid.`
      );
    }
  }

  if (manifest.commands !== undefined) {
    if (typeof manifest.commands !== "object" || manifest.commands === null || Array.isArray(manifest.commands)) {
      error("manifest_commands_invalid", '"commands" must be an object keyed by command name.');
    } else {
      let withShortcut = 0;
      for (const [name, command] of Object.entries(manifest.commands as Record<string, unknown>)) {
        const entry = (command && typeof command === "object" ? command : {}) as Record<string, unknown>;
        if (entry.suggested_key !== undefined) withShortcut++;
        const exempt = name.startsWith("_execute_");
        if (!exempt && (typeof entry.description !== "string" || entry.description.trim() === "")) {
          error("manifest_command_description", `commands.${name} needs a non-empty "description" string.`);
        }
      }
      if (withShortcut > 4) {
        error("manifest_commands_shortcuts", `Chrome allows at most 4 commands with a "suggested_key"; found ${withShortcut}.`);
      }
    }
  }

  if (manifest.key !== undefined && (typeof manifest.key !== "string" || !/^[A-Za-z0-9+/=]{100,}$/.test(manifest.key))) {
    error("manifest_key_invalid", '"key" must be a valid base64 public key. Remove it unless a fixed extension ID is needed.');
  }

  if (/__MSG_[A-Za-z0-9_@]+__/.test(rawContent) && !manifest.default_locale) {
    error(
      "manifest_msg_without_locale",
      'manifest.json uses a "__MSG_...__" localized string but has no "default_locale" and _locales folder. Use plain text instead.'
    );
  }

  return issues;
}

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

  issues.push(...validateLoadability(manifest, manifestContent));

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

export function scanFileForSecurityIssues(file: FileLike): ValidationIssue[] {
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
export function validateReferencedFiles(files: FileLike[]): ValidationIssue[] {
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

  if (typeof manifest.default_locale === "string") {
    referenced.add(`_locales/${manifest.default_locale}/messages.json`);
  }

  const sidePanel = manifest.side_panel as { default_path?: string } | undefined;
  if (sidePanel?.default_path) referenced.add(sidePanel.default_path);

  // importScripts("x.js") in a service worker (or any worker script): if x.js
  // is missing the whole worker fails to register, so treat it like any other
  // required file. Paths resolve relative to the importing file; remote URLs
  // are skipped (MV3 forbids remote code and the other checks cover that).
  for (const file of files) {
    if (!file.path.endsWith(".js")) continue;
    const dir = file.path.includes("/") ? file.path.slice(0, file.path.lastIndexOf("/") + 1) : "";
    for (const call of file.content.matchAll(/\bimportScripts\s*\(([^)]*)\)/g)) {
      for (const literal of call[1].matchAll(/["'`]([^"'`]+)["'`]/g)) {
        const target = literal[1];
        if (/^[a-z]+:/i.test(target)) continue;
        referenced.add(target.startsWith("/") ? target.slice(1) : dir + target.replace(/^\.\//, ""));
      }
    }
  }

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

  // HTML files referencing local scripts/styles that don't exist. A missing
  // <script src> is an error: the page loads but nothing in it works (a
  // popup full of dead buttons), which used to pass validation as a mere
  // warning. A missing stylesheet or other file stays a warning.
  for (const file of files.filter((f) => f.path.endsWith(".html"))) {
    const scriptRefs = new Set(
      [...file.content.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map((m) => m[1])
    );
    for (const match of file.content.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
      const ref = match[1];
      // Not a project file: any URL scheme (http:, data:, mailto:, javascript:,
      // chrome-extension:...), protocol-relative URLs and in-page anchors.
      if (/^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith("//") || ref.startsWith("#")) continue;

      const path = ref.replace(/[?#].*$/, "");
      const resolved = path.startsWith("/") ? path.slice(1) : resolveRelativePath(file.path, path);
      if (byPath.has(resolved)) continue;

      const isScript = scriptRefs.has(ref);
      issues.push({
        level: isScript ? "error" : "warning",
        code: isScript ? "missing_script_reference" : "missing_html_reference",
        message: `${file.path} references "${ref}" but that file does not exist in the project.`,
        path: file.path,
      });
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
