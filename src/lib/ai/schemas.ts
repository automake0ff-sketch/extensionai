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
 * Models sometimes wrap JSON in markdown fences despite instructions.
 * Strip those defensively before parsing.
 */
export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  return JSON.parse(candidate);
}
