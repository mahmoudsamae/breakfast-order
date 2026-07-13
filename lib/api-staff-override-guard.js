import { NextResponse } from "next/server";
import { requireBranchSession } from "@/lib/api-branch-guard";
import { getStaffOverrideFromCookies } from "@/lib/staff-override-session";

/**
 * Branch session + PIN override cookie for correction endpoints.
 * @param {string} routeSlug
 * @param {('team'|'admin')[]} allowedRoles
 */
export async function requireStaffOverride(routeSlug, allowedRoles = ["team", "admin"]) {
  const { error: authErr, session } = await requireBranchSession(routeSlug, allowedRoles);
  if (authErr) return { error: authErr, session: null, override: null };

  const override = await getStaffOverrideFromCookies();
  if (!override) {
    return {
      error: NextResponse.json({ error: "Korrektur-PIN erforderlich." }, { status: 403 }),
      session: null,
      override: null
    };
  }
  if (Number(override.branchId) !== Number(session.branchId)) {
    return {
      error: NextResponse.json({ error: "Korrektur-Sitzung gehört nicht zu diesem Standort." }, { status: 403 }),
      session: null,
      override: null
    };
  }

  return { error: null, session, override };
}
