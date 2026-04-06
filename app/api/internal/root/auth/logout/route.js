import { NextResponse } from "next/server";
import { ROOT_SESSION_COOKIE_NAME, rootSessionCookieOptions } from "@/lib/root-session";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ROOT_SESSION_COOKIE_NAME, "", { ...rootSessionCookieOptions(), maxAge: 0 });
  return res;
}
