import { z } from "zod";

// These schemas are the enforcement point mentioned in spec section 7:
// "NO aceptar respuestas de IA arbitrarias... Validar la respuesta antes de
// almacenarla." Every AI call in lib/ai/extension.ts is parsed through one
// of these before it ever touches the database.

export const generatedFileSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
});

export const architectPlanSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  permissions: z.array(z.string()),
  host_permissions: z.array(z.string()),
  components: z.object({
    background: z.boolean(),
    content_script: z.boolean(),
    popup: z.boolean(),
    options_page: z.boolean(),
  }),
  files_plan: z.array(z.string()),
  notes: z.string(),
});

export const extensionGenerationSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  files: z.array(generatedFileSchema).min(1),
});

export const fileChangeSchema = z.object({
  path: z.string().min(1),
  action: z.enum(["create", "update", "delete"]),
  content: z.string().nullable().optional(),
});

export const extensionModificationSchema = z.object({
  message: z.string(),
  changes: z.array(fileChangeSchema),
});

export const extensionAnalysisSchema = z.object({
  summary: z.string(),
  permissionsUsed: z.array(z.string()),
  unnecessaryPermissions: z.array(z.string()),
  risks: z.array(z.string()),
});

export const testCaseSchema = z.object({
  title: z.string(),
  status: z.enum(["planned", "manual_verification_required"]),
  notes: z.string().nullable().optional(),
});

export const testPlanSchema = z.object({
  cases: z.array(testCaseSchema),
});

/**
 * Repairs the two most common ways LLMs break JSON when they embed source
 * code inside string values: backslashes that aren't valid JSON escapes
 * (e.g. a regex like \d written with a single backslash) and raw control
 * characters (literal newlines/tabs) inside strings. Only touches content
 * inside string literals; structure outside strings is left alone.
 */
export function repairJsonStrings(input: string): string {
  let out = "";
  let inString = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (!inString) {
      if (ch === '"') inString = true;
      out += ch;
      continue;
    }
    if (ch === "\\") {
      const next = input[i + 1];
      if (next === undefined) {
        out += "\\\\";
      } else if ('"\\/bfnrt'.includes(next)) {
        out += ch + next;
        i++;
      } else if (next === "u" && /^[0-9a-fA-F]{4}$/.test(input.slice(i + 2, i + 6))) {
        out += input.slice(i, i + 6);
        i += 5;
      } else {
        // Not a valid escape: keep the backslash literally.
        out += "\\\\";
      }
      continue;
    }
    if (ch === '"') {
      inString = false;
      out += ch;
    } else if (ch === "\n") {
      out += "\\n";
    } else if (ch === "\r") {
      out += "\\r";
    } else if (ch === "\t") {
      out += "\\t";
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * Models sometimes wrap JSON in markdown fences or add prose around it, and
 * often produce slightly invalid JSON when file contents are embedded.
 * Strip fences, isolate the outermost object, and fall back to a string-aware
 * repair pass if a strict parse fails.
 */
export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  // Only treat the response as fenced if it *starts* with a fence. Bare JSON
  // can legitimately contain ``` inside string values (e.g. a README).
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*)```\s*$/i);
  let candidate = fenced ? fenced[1].trim() : trimmed;
  const first = candidate.indexOf("{");
  const last = candidate.lastIndexOf("}");
  if (first >= 0 && last > first) candidate = candidate.slice(first, last + 1);
  try {
    return JSON.parse(candidate);
  } catch (strictError) {
    try {
      return JSON.parse(repairJsonStrings(candidate));
    } catch {
      throw strictError;
    }
  }
}
