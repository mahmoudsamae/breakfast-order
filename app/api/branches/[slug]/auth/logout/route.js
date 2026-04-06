import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/internal-session";

export const dynamic = "force-dynamic";

export async function POST(_, { params }) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0
  });
  return res;
}
