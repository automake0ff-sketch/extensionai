import JSZip from "jszip";
import type { ProjectFile } from "@/lib/types";

/**
 * Builds a downloadable ZIP of the project's current files, ready to be
 * loaded unpacked via chrome://extensions (spec section 14). Adds a README
 * with load instructions if the project doesn't already have one.
 */
export async function buildExtensionZip(
  projectName: string,
  files: ProjectFile[]
): Promise<Buffer> {
  const zip = new JSZip();

  for (const file of files) {
    zip.file(file.path, file.content);
  }

  if (!files.some((f) => f.path.toLowerCase() === "readme.md")) {
    zip.file(
      "README.md",
      `# ${projectName}\n\nGenerated with ExtenAI.\n\n## Load this extension in Chrome\n\n1. Unzip this file.\n2. Open \`chrome://extensions\`.\n3. Enable "Developer mode" (top-right toggle).\n4. Click "Load unpacked" and select the unzipped folder.\n`
    );
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return buffer;
}

export function slugifyFilename(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "extension"
  );
}
