import { NextResponse } from "next/server";
import { getSession } from "@/lib/firebase/session";
import { track, type AnalyticsEvent } from "@/lib/analytics";

/**
 * Only events that genuinely can't be observed server-side (a tab switch in
 * the editor) go through this route, and only from this fixed allow-list —
 * an open "log whatever event name and properties the client sends" endpoint
 * would let anyone pollute analytics with arbitrary data.
 */
const CLIENT_ALLOWED_EVENTS: AnalyticsEvent[] = ["preview_opened"];

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const event = body?.event as AnalyticsEvent | undefined;
  const projectId = body?.projectId as string | undefined;

  if (!event || !CLIENT_ALLOWED_EVENTS.includes(event)) {
    return NextResponse.json({ error: "Unknown or disallowed event." }, { status: 400 });
  }

  await track(event, session.uid, projectId ? { projectId } : {});
  return NextResponse.json({ ok: true });
}
