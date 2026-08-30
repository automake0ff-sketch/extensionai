import type { ProjectFile } from "@/lib/types";

/**
 * Hard limits on generated/edited extensions (spec section 22: "limitar
 * tamaño de proyectos"). These are deliberately generous for a real Chrome
 * extension — a legitimate project rarely needs more than a few dozen small
 * files — but stop a runaway AI response or a pasted-in blob from silently
 * growing an unbounded Firestore document or ZIP.
 */
export const MAX_FILES_PER_PROJECT = 60;
export const MAX_FILE_SIZE_BYTES = 300 * 1024; // 300 KB
export const MAX_PROJECT_SIZE_BYTES = 3 * 1024 * 1024; // 3 MB total

export class ProjectLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectLimitError";
  }
}

function byteLength(content: string): number {
  return Buffer.byteLength(content, "utf8");
}

/**
 * Validates a full file set (used after generation, and when computing the
 * result of applying a proposed modification) against the limits above.
 * Throws ProjectLimitError with a person-readable message on violation.
 */
export function assertWithinProjectLimits(files: { path: string; content: string }[]): void {
  if (files.length > MAX_FILES_PER_PROJECT) {
    throw new ProjectLimitError(
      `This extension has ${files.length} files, which is over the ${MAX_FILES_PER_PROJECT}-file limit per project. Try splitting it into a smaller extension or removing unused files.`
    );
  }

  let totalBytes = 0;
  for (const file of files) {
    const size = byteLength(file.content);
    if (size > MAX_FILE_SIZE_BYTES) {
      throw new ProjectLimitError(
        `"${file.path}" is ${Math.round(size / 1024)} KB, which is over the ${Math.round(
          MAX_FILE_SIZE_BYTES / 1024
        )} KB per-file limit.`
      );
    }
    totalBytes += size;
  }

  if (totalBytes > MAX_PROJECT_SIZE_BYTES) {
    throw new ProjectLimitError(
      `This extension is ${Math.round(totalBytes / 1024)} KB total, which is over the ${Math.round(
        MAX_PROJECT_SIZE_BYTES / 1024
      )} KB per-project limit.`
    );
  }
}

/**
 * Same check, but applied as "current files with a proposed set of changes
 * layered on top" — used before accepting a Modifier diff, so a chat edit
 * can't sneak a project over the limit one small change at a time.
 */
export function assertChangesWithinProjectLimits(
  currentFiles: ProjectFile[],
  changes: { path: string; action: "create" | "update" | "delete"; content?: string | null }[]
): void {
  const byPath = new Map(currentFiles.map((f) => [f.path, f.content]));
  for (const change of changes) {
    if (change.action === "delete") {
      byPath.delete(change.path);
    } else {
      byPath.set(change.path, change.content ?? "");
    }
  }
  assertWithinProjectLimits(Array.from(byPath.entries()).map(([path, content]) => ({ path, content })));
}
