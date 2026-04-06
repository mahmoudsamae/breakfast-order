import { NextResponse } from "next/server";
import { getRootSessionFromCookies } from "@/lib/root-session";

export async function requireRootSession() {
  const session = await getRootSessionFromCookies();
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }), session: null };
  }
  return { error: null, session };
}
