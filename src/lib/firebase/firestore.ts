import { adminDb } from "./admin";
import type {
  ChatMessage,
  FileChange,
  FileVersion,
  Generation,
  GenerationKind,
  Profile,
  Project,
  ProjectFile,
  ProjectStatus,
} from "@/lib/types";

/**
 * Firestore schema (see ARCHITECTURE.md for the full write-up):
 *
 *   profiles/{uid}
 *   projects/{projectId}
 *     files/{autoId}        -- field `path` holds the file path (Firestore doc
 *                               IDs can't contain "/", so path is a field, not the ID)
 *     versions/{autoId}
 *     generations/{autoId}
 *     messages/{autoId}
 *   usage/{uid}_{period}
 *
 * All access here uses the Admin SDK, which bypasses Firestore security
 * rules entirely — every function below is responsible for its own
 * ownership check (see lib/firebase/guards.ts), mirroring what Postgres RLS
 * used to do automatically.
 */

function projectsCol() {
  return adminDb().collection("projects");
}

function filesCol(projectId: string) {
  return projectsCol().doc(projectId).collection("files");
}

function versionsCol(projectId: string) {
  return projectsCol().doc(projectId).collection("versions");
}

function generationsCol(projectId: string) {
  return projectsCol().doc(projectId).collection("generations");
}

function messagesCol(projectId: string) {
  return projectsCol().doc(projectId).collection("messages");
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Closed beta waitlist
// ---------------------------------------------------------------------------
// waitlist/{normalizedEmail}: { email, status: "pending" | "approved",
// niche, createdAt, approvedAt }. Gates account creation while the product
// is in closed beta — see POST /api/auth/session. There is no admin UI for
// approving people yet; flip a doc's `status` field to "approved" directly
// in the Firestore console.

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function joinWaitlist(
  email: string,
  fields: { niche?: string } = {}
): Promise<{ alreadyOnList: boolean }> {
  const id = normalizeEmail(email);
  const ref = adminDb().collection("waitlist").doc(id);
  const existing = await ref.get();
  if (existing.exists) {
    return { alreadyOnList: true };
  }
  await ref.set({
    email: id,
    status: "pending",
    niche: fields.niche ?? null,
    createdAt: new Date().toISOString(),
    approvedAt: null,
  });
  return { alreadyOnList: false };
}

export async function isEmailApproved(email: string): Promise<boolean> {
  const snap = await adminDb().collection("waitlist").doc(normalizeEmail(email)).get();
  return snap.exists && snap.data()?.status === "approved";
}

export async function getProfile(uid: string): Promise<Profile | null> {
  const snap = await adminDb().collection("profiles").doc(uid).get();
  if (!snap.exists) return null;
  const data = snap.data()!;
  return {
    id: snap.id,
    email: data.email,
    name: data.name ?? null,
    avatar_url: data.avatarUrl ?? null,
    plan: data.plan,
    stripe_customer_id: data.stripeCustomerId ?? null,
    stripe_subscription_id: data.stripeSubscriptionId ?? null,
    created_at: data.createdAt,
  };
}

/** Used by the Stripe webhook, which only knows the Stripe customer ID. */
export async function getProfileByStripeCustomerId(customerId: string): Promise<Profile | null> {
  const snap = await adminDb().collection("profiles").where("stripeCustomerId", "==", customerId).limit(1).get();
  if (snap.empty) return null;
  return getProfile(snap.docs[0].id);
}

export async function updateProfileBilling(
  uid: string,
  fields: { plan?: Profile["plan"]; stripeCustomerId?: string | null; stripeSubscriptionId?: string | null }
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (fields.plan !== undefined) update.plan = fields.plan;
  if (fields.stripeCustomerId !== undefined) update.stripeCustomerId = fields.stripeCustomerId;
  if (fields.stripeSubscriptionId !== undefined) update.stripeSubscriptionId = fields.stripeSubscriptionId;
  await adminDb().collection("profiles").doc(uid).update(update);
}

// ---------------------------------------------------------------------------
// GitHub connection (see lib/github/client.ts)
// ---------------------------------------------------------------------------

export async function saveGithubConnection(
  uid: string,
  fields: { githubLogin: string; encryptedAccessToken: string }
): Promise<void> {
  await adminDb().collection("githubConnections").doc(uid).set({
    githubLogin: fields.githubLogin,
    encryptedAccessToken: fields.encryptedAccessToken,
    connectedAt: new Date().toISOString(),
  });
}

export async function getGithubConnection(
  uid: string
): Promise<{ githubLogin: string; encryptedAccessToken: string } | null> {
  const snap = await adminDb().collection("githubConnections").doc(uid).get();
  if (!snap.exists) return null;
  const data = snap.data()!;
  return { githubLogin: data.githubLogin, encryptedAccessToken: data.encryptedAccessToken };
}

export async function deleteGithubConnection(uid: string): Promise<void> {
  await adminDb().collection("githubConnections").doc(uid).delete();
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function listProjects(uid: string): Promise<Project[]> {
  const snap = await projectsCol().where("userId", "==", uid).orderBy("updatedAt", "desc").get();
  return snap.docs.map((doc) => docToProject(doc.id, doc.data()));
}

/** Returns the project only if it belongs to `uid`, otherwise null. */
export async function getOwnedProject(uid: string, projectId: string): Promise<Project | null> {
  const snap = await projectsCol().doc(projectId).get();
  if (!snap.exists) return null;
  const data = snap.data()!;
  if (data.userId !== uid) return null;
  return docToProject(snap.id, data);
}

export async function createProject(
  uid: string,
  fields: { name: string; description: string | null }
): Promise<Project> {
  const now = new Date().toISOString();
  const ref = await projectsCol().add({
    userId: uid,
    name: fields.name,
    description: fields.description,
    status: "draft" satisfies ProjectStatus,
    manifestSummary: null,
    createdAt: now,
    updatedAt: now,
  });
  const snap = await ref.get();
  return docToProject(snap.id, snap.data()!);
}

export async function updateProject(
  projectId: string,
  fields: Partial<Pick<Project, "name" | "description" | "status" | "manifest_summary">>
): Promise<void> {
  const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (fields.name !== undefined) update.name = fields.name;
  if (fields.description !== undefined) update.description = fields.description;
  if (fields.status !== undefined) update.status = fields.status;
  if (fields.manifest_summary !== undefined) update.manifestSummary = fields.manifest_summary;
  await projectsCol().doc(projectId).update(update);
}

function docToProject(id: string, data: FirebaseFirestore.DocumentData): Project {
  return {
    id,
    user_id: data.userId,
    name: data.name,
    description: data.description ?? null,
    status: data.status,
    manifest_summary: data.manifestSummary ?? null,
    created_at: data.createdAt,
    updated_at: data.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Project files
// ---------------------------------------------------------------------------

export async function getProjectFiles(projectId: string): Promise<ProjectFile[]> {
  const snap = await filesCol(projectId).orderBy("path").get();
  return snap.docs.map((doc) => docToFile(projectId, doc.id, doc.data()));
}

export async function getProjectFileByPath(projectId: string, path: string): Promise<ProjectFile | null> {
  const snap = await filesCol(projectId).where("path", "==", path).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return docToFile(projectId, doc.id, doc.data());
}

/** Deletes every existing file and writes the given set (used for full generation/regeneration). */
export async function replaceProjectFiles(
  projectId: string,
  files: { path: string; content: string }[]
): Promise<void> {
  const db = adminDb();
  const existing = await filesCol(projectId).get();
  const batch = db.batch();
  existing.docs.forEach((doc) => batch.delete(doc.ref));
  const now = new Date().toISOString();
  files.forEach((file) => {
    const ref = filesCol(projectId).doc();
    batch.set(ref, { path: file.path, content: file.content, createdAt: now, updatedAt: now });
  });
  await batch.commit();
}

/** Creates or overwrites a single file by path. */
export async function upsertProjectFile(projectId: string, path: string, content: string): Promise<void> {
  const now = new Date().toISOString();
  const existing = await filesCol(projectId).where("path", "==", path).limit(1).get();
  if (existing.empty) {
    await filesCol(projectId).add({ path, content, createdAt: now, updatedAt: now });
  } else {
    await existing.docs[0].ref.update({ content, updatedAt: now });
  }
}

export async function deleteProjectFileByPath(projectId: string, path: string): Promise<void> {
  const existing = await filesCol(projectId).where("path", "==", path).limit(1).get();
  await Promise.all(existing.docs.map((doc) => doc.ref.delete()));
}

function docToFile(projectId: string, id: string, data: FirebaseFirestore.DocumentData): ProjectFile {
  return {
    id,
    project_id: projectId,
    path: data.path,
    content: data.content,
    created_at: data.createdAt,
    updated_at: data.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// File versions (snapshot-before-overwrite, see spec section 11/12)
// ---------------------------------------------------------------------------

export async function snapshotFileVersion(
  projectId: string,
  path: string,
  content: string,
  createdBy: "ai" | "user"
): Promise<void> {
  const latest = await versionsCol(projectId)
    .where("path", "==", path)
    .orderBy("versionNumber", "desc")
    .limit(1)
    .get();
  const nextVersion = latest.empty ? 1 : (latest.docs[0].data().versionNumber as number) + 1;
  await versionsCol(projectId).add({
    path,
    content,
    versionNumber: nextVersion,
    createdBy,
    createdAt: new Date().toISOString(),
  });
}

export async function listFileVersions(projectId: string, path: string): Promise<FileVersion[]> {
  const snap = await versionsCol(projectId).where("path", "==", path).orderBy("versionNumber", "desc").get();
  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      project_id: projectId,
      path: data.path,
      content: data.content,
      version_number: data.versionNumber,
      created_by: data.createdBy,
      created_at: data.createdAt,
    };
  });
}

export async function getFileVersionById(projectId: string, versionId: string): Promise<FileVersion | null> {
  const snap = await versionsCol(projectId).doc(versionId).get();
  if (!snap.exists) return null;
  const data = snap.data()!;
  return {
    id: snap.id,
    project_id: projectId,
    path: data.path,
    content: data.content,
    version_number: data.versionNumber,
    created_by: data.createdBy,
    created_at: data.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Generations
// ---------------------------------------------------------------------------

export async function createGeneration(
  projectId: string,
  uid: string,
  kind: GenerationKind,
  prompt: string,
  model: string
): Promise<string> {
  const ref = await generationsCol(projectId).add({
    userId: uid,
    kind,
    prompt,
    model,
    status: "pending",
    errorMessage: null,
    tokensUsed: 0,
    createdAt: new Date().toISOString(),
  });
  return ref.id;
}

export async function completeGeneration(
  projectId: string,
  generationId: string,
  fields: { status: "success" | "error"; tokensUsed?: number; model?: string; errorMessage?: string }
): Promise<void> {
  const update: Record<string, unknown> = { status: fields.status };
  if (fields.tokensUsed !== undefined) update.tokensUsed = fields.tokensUsed;
  if (fields.model !== undefined) update.model = fields.model;
  if (fields.errorMessage !== undefined) update.errorMessage = fields.errorMessage;
  await generationsCol(projectId).doc(generationId).update(update);
}

/**
 * Stores a Modifier result as "pending review" instead of applying it —
 * spec section 11's Accept/Reject flow. `POST /api/modify/apply` or
 * `/api/modify/discard` resolve it later.
 */
export async function markGenerationPendingReview(
  projectId: string,
  generationId: string,
  fields: { tokensUsed: number; model: string; message: string; changes: FileChange[] }
): Promise<void> {
  await generationsCol(projectId).doc(generationId).update({
    status: "pending_review",
    tokensUsed: fields.tokensUsed,
    model: fields.model,
    pendingMessage: fields.message,
    pendingChanges: fields.changes,
  });
}

interface PendingGeneration {
  id: string;
  status: string;
  pendingMessage: string;
  pendingChanges: FileChange[];
}

/** Returns the generation only if it belongs to the given project and is still pending review. */
export async function getPendingGeneration(
  projectId: string,
  generationId: string
): Promise<PendingGeneration | null> {
  const snap = await generationsCol(projectId).doc(generationId).get();
  if (!snap.exists) return null;
  const data = snap.data()!;
  if (data.status !== "pending_review") return null;
  return {
    id: snap.id,
    status: data.status,
    pendingMessage: data.pendingMessage ?? "",
    pendingChanges: data.pendingChanges ?? [],
  };
}

export async function resolveGeneration(
  projectId: string,
  generationId: string,
  status: "success" | "discarded"
): Promise<void> {
  await generationsCol(projectId).doc(generationId).update({ status });
}

export async function listGenerations(projectId: string): Promise<Generation[]> {
  const snap = await generationsCol(projectId).orderBy("createdAt", "desc").get();
  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      project_id: projectId,
      user_id: data.userId,
      kind: data.kind,
      prompt: data.prompt,
      model: data.model,
      status: data.status,
      error_message: data.errorMessage ?? null,
      tokens_used: data.tokensUsed,
      created_at: data.createdAt,
    };
  });
}

// ---------------------------------------------------------------------------
// Chat messages
// ---------------------------------------------------------------------------

export async function addChatMessage(
  projectId: string,
  uid: string,
  role: "user" | "assistant" | "system",
  content: string
): Promise<void> {
  await messagesCol(projectId).add({ userId: uid, role, content, createdAt: new Date().toISOString() });
}

export async function listChatMessages(projectId: string, limitCount?: number): Promise<ChatMessage[]> {
  let query = messagesCol(projectId).orderBy("createdAt", "asc") as FirebaseFirestore.Query;
  if (limitCount) {
    query = messagesCol(projectId).orderBy("createdAt", "desc").limit(limitCount);
  }
  const snap = await query.get();
  const docs = limitCount ? snap.docs.slice().reverse() : snap.docs;
  return docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      project_id: projectId,
      user_id: data.userId,
      role: data.role,
      content: data.content,
      created_at: data.createdAt,
    };
  });
}

// ---------------------------------------------------------------------------
// Usage / credits
// ---------------------------------------------------------------------------

export async function getUsageDoc(uid: string, period: string): Promise<{ creditsUsed: number } | null> {
  const snap = await adminDb().collection("usage").doc(`${uid}_${period}`).get();
  return snap.exists ? { creditsUsed: snap.data()!.creditsUsed } : null;
}

export async function incrementUsage(uid: string, period: string, credits: number): Promise<void> {
  const ref = adminDb().collection("usage").doc(`${uid}_${period}`);
  await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      tx.update(ref, { creditsUsed: (snap.data()!.creditsUsed as number) + credits });
    } else {
      tx.set(ref, { userId: uid, period, creditsUsed: credits });
    }
  });
}
