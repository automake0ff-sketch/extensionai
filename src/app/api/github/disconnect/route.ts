import { NextResponse } from "next/server";
import { getSession } from "@/lib/firebase/session";
import { deleteGithubConnection } from "@/lib/firebase/firestore";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  await deleteGithubConnection(session.uid);
  return NextResponse.json({ ok: true });
}
