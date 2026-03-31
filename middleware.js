import { NextResponse } from "next/server";
import { getInternalRole, isAdminRole, isStaffRole } from "@/lib/auth-internal";

export function middleware(request) {
  const pathname = request.nextUrl.pathname;
  const role = getInternalRole(request);
  if (pathname === "/admin" || pathname === "/admin/") {
    if (!isAdminRole(role)) return NextResponse.redirect(new URL("/order", request.url));
  }
  if (pathname === "/staff" || pathname === "/staff/") {
    if (!isStaffRole(role)) return NextResponse.redirect(new URL("/order", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/staff", "/staff/", "/admin", "/admin/"] };
