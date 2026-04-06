import { NextResponse } from "next/server";
import { getSessionFromCookies, normalizeBranchSlug } from "@/lib/internal-session";

/**
 * @param {string} routeSlug - [slug] from URL
 * @param {('team'|'admin')[]} allowedRoles
 */
export async function requireBranchSession(routeSlug, allowedRoles) {
  const slug = normalizeBranchSlug(routeSlug);
  const session = await getSessionFromCookies();
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }), session: null };
  }
  const sessionSlug = normalizeBranchSlug(session.branchSlug);
  if (sessionSlug !== slug) {
    return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }), session: null };
  }
  if (!allowedRoles.includes(session.role)) {
    return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }), session: null };
  }
  return { error: null, session };
}
