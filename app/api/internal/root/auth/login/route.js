import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import {
  createRootSessionToken,
  ROOT_SESSION_COOKIE_NAME,
  rootSessionCookieOptions
} from "@/lib/root-session";
import {
  clearLoginFailuresForUser,
  clientIpHashFromRequest,
  INVALID_LOGIN_MESSAGE,
  LOGIN_LOCKED_MESSAGE,
  loginIsBlocked,
  recordLoginFailure
} from "@/lib/login-attempts";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const body = await req.json();
    const username = String(body.username || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");

    if (!username || !password) {
      return NextResponse.json({ error: "Benutzername und Passwort erforderlich." }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const ipHash = clientIpHashFromRequest(req);
    const attemptKey = { scope: "root", username, ipHash };
    if (await loginIsBlocked(attemptKey)) {
      return NextResponse.json(
        { error: LOGIN_LOCKED_MESSAGE },
        { status: 429, headers: { "Retry-After": "900" } }
      );
    }

    const { data: row, error } = await supabase
      .from("root_admins")
      .select("id,password_hash,is_active")
      .eq("username", username)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!row?.password_hash || !row.is_active) {
      await recordLoginFailure(attemptKey);
      return NextResponse.json({ error: INVALID_LOGIN_MESSAGE }, { status: 401 });
    }

    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) {
      await recordLoginFailure(attemptKey);
      return NextResponse.json({ error: INVALID_LOGIN_MESSAGE }, { status: 401 });
    }

    await clearLoginFailuresForUser(attemptKey);

    const now = Math.floor(Date.now() / 1000);
    const exp = now + 60 * 60 * 24 * 7;
    const token = createRootSessionToken({
      kind: "root",
      rootAdminId: Number(row.id),
      username,
      exp
    });

    const res = NextResponse.json({ ok: true });
    res.cookies.set(ROOT_SESSION_COOKIE_NAME, token, rootSessionCookieOptions());
    return res;
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
