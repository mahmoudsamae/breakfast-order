export const INTERNAL_ROLE_COOKIE = "fb_internal_role";

/** @param {import('next/server').NextRequest} req */
export function getInternalRole(req) {
  return req.cookies.get(INTERNAL_ROLE_COOKIE)?.value || null;
}

export function isStaffRole(role) {
  return role === "team" || role === "admin";
}

export function isAdminRole(role) {
  return role === "admin";
}
