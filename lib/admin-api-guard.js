import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { INTERNAL_ROLE_COOKIE } from "@/lib/auth-internal";

export function requireAdminCookie() {
  const role = cookies().get(INTERNAL_ROLE_COOKIE)?.value;
  if (role !== "admin") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  return null;
}
