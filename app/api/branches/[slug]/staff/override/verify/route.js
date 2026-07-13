import { NextResponse } from "next/server";
import { requireBranchSession } from "@/lib/api-branch-guard";
import { fetchBranchBySlug } from "@/lib/branch-server";
import {
  createStaffOverrideToken,
  staffOverrideCookieOptions,
  STAFF_OVERRIDE_COOKIE_NAME,
  verifyStaffOverridePin
} from "@/lib/staff-override-session";

export const dynamic = "force-dynamic";

export async function POST(req, { params }) {
  const { error: authErr, session } = await requireBranchSession(params.slug, ["team", "admin"]);
  if (authErr) return authErr;

  const { branch, error: brErr } = await fetchBranchBySlug(params.slug);
  if (brErr || !branch) return NextResponse.json({ error: "Standort nicht gefunden." }, { status: 404 });

  try {
    const body = await req.json();
    const pin = String(body.pin || "").trim();
    if (!verifyStaffOverridePin(pin)) {
      return NextResponse.json({ error: "Falscher PIN." }, { status: 401 });
    }

    const now = Math.floor(Date.now() / 1000);
    const token = createStaffOverrideToken({
      branchId: Number(session.branchId),
      exp: now + 60 * 15
    });

    const res = NextResponse.json({ ok: true, expiresInSec: 60 * 15 });
    res.cookies.set(STAFF_OVERRIDE_COOKIE_NAME, token, staffOverrideCookieOptions());
    return res;
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
