import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { fetchBranchBySlug } from "@/lib/branch-server";
import {
  createSessionToken,
  normalizeBranchSlug,
  SESSION_COOKIE_NAME,
  sessionCookieOptions
} from "@/lib/internal-session";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req, { params }) {
  try {
    const { branch, error: brErr } = await fetchBranchBySlug(params.slug);
    if (brErr || !branch) {
      return NextResponse.json({ error: "Standort nicht gefunden." }, { status: 404 });
    }

    const body = await req.json();
    const username = String(body.username || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");

    if (!username || !password) {
      return NextResponse.json({ error: "Benutzername und Passwort erforderlich." }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data: cred, error } = await supabase
      .from("branch_credentials")
      .select("id,password_hash,role")
      .eq("branch_id", branch.id)
      .eq("username", username)
      .eq("is_active", true)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!cred?.password_hash) {
      return NextResponse.json({ error: "Ungültige Zugangsdaten." }, { status: 401 });
    }

    const ok = await bcrypt.compare(password, cred.password_hash);
    if (!ok) {
      return NextResponse.json({ error: "Ungültige Zugangsdaten." }, { status: 401 });
    }

    if (cred.role !== "team" && cred.role !== "admin") {
      return NextResponse.json({ error: "Ungültige Rolle." }, { status: 403 });
    }

    const now = Math.floor(Date.now() / 1000);
    const exp = now + 60 * 60 * 24 * 7;
    const slugCanonical = normalizeBranchSlug(branch.slug);
    const token = createSessionToken({
      branchId: Number(branch.id),
      branchSlug: slugCanonical,
      role: cred.role,
      exp
    });

    const res = NextResponse.json({
      ok: true,
      role: cred.role,
      branchSlug: slugCanonical
    });
    res.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
    return res;
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
