// Shared domain types, mirroring the Firestore schema (see
// src/lib/firebase/firestore.ts for the collection layout). Keeping these
// hand-written makes the AI layer and API routes easy to read without a
// generated-types step in the MVP.

export type ProjectStatus = "draft" | "generating" | "ready" | "error";

export interface Profile {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  plan: "free" | "pro" | "pro_plus";
  created_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  manifest_summary: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  path: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface FileVersion {
  id: string;
  project_id: string;
  path: string;
  content: string;
  version_number: number;
  created_by: "ai" | "user";
  created_at: string;
}

export type GenerationKind = "generate" | "modify" | "analyze" | "tests";

export interface Generation {
  id: string;
  project_id: string;
  user_id: string;
  kind: GenerationKind;
  prompt: string;
  model: string;
  status: "pending" | "success" | "error";
  error_message: string | null;
  tokens_used: number;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  project_id: string;
  user_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

// -----------------------------------------------------------------------------
// AI layer contracts (lib/ai)
// -----------------------------------------------------------------------------

/** A single file the AI wants to create or fully rewrite. */
export interface GeneratedFile {
  path: string;
  content: string;
}

/** Full-project generation result — see spec section 7. */
export interface ExtensionGenerationResult {
  name: string;
  description: string;
  files: GeneratedFile[];
}

/** A single change the AI wants to apply to an existing project — see section 10. */
export interface FileChange {
  path: string;
  action: "create" | "update" | "delete";
  content?: string | null; // omitted or null for "delete"
}

/** Result of a chat-driven modification request. */
export interface ExtensionModificationResult {
  message: string;
  changes: FileChange[];
}

/** Result of running the Reviewer/Analyzer prompt over a project. */
export interface ExtensionAnalysisResult {
  summary: string;
  permissionsUsed: string[];
  unnecessaryPermissions: string[];
  risks: string[];
}

export interface TestCase {
  title: string;
  status: "planned" | "manual_verification_required";
  notes?: string | null;
}

export interface TestPlanResult {
  cases: TestCase[];
}

export interface ValidationIssue {
  level: "error" | "warning";
  code: string;
  message: string;
  path?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}
