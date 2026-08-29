import { notFound } from "next/navigation";
import { getSession } from "@/lib/firebase/session";
import { getOwnedProject, getProjectFiles, listChatMessages } from "@/lib/firebase/firestore";
import { ProjectWorkspace } from "@/components/editor/project-workspace";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) notFound();

  const project = await getOwnedProject(session.uid, id);
  if (!project) notFound();

  const [files, messages] = await Promise.all([getProjectFiles(id), listChatMessages(id)]);

  return <ProjectWorkspace project={project} initialFiles={files} initialMessages={messages} />;
}
