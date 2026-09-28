/**
 * Post-processing for AI-generated file sets.
 *
 * The AI can only produce text files, but it often writes a manifest that
 * points at icon images ("icon16.png", ...) it never creates. Chrome refuses
 * to load an extension whose manifest references a missing icon ("Could not
 * load icon ... specified in 'action'"), so a generated extension would
 * fail on its very first load. Dropping references to files that don't exist
 * is safe: Chrome simply shows its default icon.
 */

interface TextFile {
  path: string;
  content: string;
}

const normalize = (p: string) => p.replace(/^\.?\//, "").replace(/^\//, "");

export function stripMissingManifestIcons<T extends TextFile>(
  files: T[]
): { files: T[]; removed: string[] } {
  const idx = files.findIndex((f) => f.path === "manifest.json");
  if (idx === -1) return { files, removed: [] };

  let manifest: Record<string, unknown>;
  try {
    const parsed = JSON.parse(files[idx].content);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { files, removed: [] };
    manifest = parsed as Record<string, unknown>;
  } catch {
    return { files, removed: [] };
  }

  const existing = new Set(files.map((f) => normalize(f.path)));
  const removed: string[] = [];

  const clean = (holder: Record<string, unknown>, key: string) => {
    const value = holder[key];
    if (typeof value === "string") {
      if (!existing.has(normalize(value))) {
        removed.push(value);
        delete holder[key];
      }
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      const sizes = value as Record<string, unknown>;
      for (const [size, p] of Object.entries(sizes)) {
        if (typeof p === "string" && !existing.has(normalize(p))) {
          removed.push(p);
          delete sizes[size];
        }
      }
      if (Object.keys(sizes).length === 0) delete holder[key];
    }
  };

  clean(manifest, "icons");
  const action = manifest.action;
  if (action && typeof action === "object" && !Array.isArray(action)) {
    clean(action as Record<string, unknown>, "default_icon");
  }

  if (removed.length === 0) return { files, removed };

  const next = [...files];
  next[idx] = { ...files[idx], content: JSON.stringify(manifest, null, 2) + "\n" };
  return { files: next, removed };
}
