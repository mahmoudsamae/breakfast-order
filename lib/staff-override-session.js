import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

/** Short-lived unlock for staff order corrections (PIN-gated). */
export const STAFF_OVERRIDE_COOKIE_NAME = "fb_staff_override";

const MAX_AGE_SEC = 60 * 15;

function getSecret() {
  const s = process.env.INTERNAL_SESSION_SECRET;
  if (!s || String(s).length < 16) {
    throw new Error("INTERNAL_SESSION_SECRET must be set (min 16 characters)");
  }
  return String(s);
}

/** Fixed PIN for staff order corrections (5-tap hidden menu). */
const STAFF_OVERRIDE_PIN = "93049";

export function getStaffOverridePin() {
  return STAFF_OVERRIDE_PIN;
}

export function verifyStaffOverridePin(input) {
  const expected = getStaffOverridePin();
  const given = String(input || "").trim();
  if (!/^\d{4,8}$/.test(given)) return false;
  try {
    const a = Buffer.from(given, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * @param {{ branchId: number, exp: number }} payload
 */
export function createStaffOverrideToken(payload) {
  const secret = getSecret();
  const body = Buffer.from(JSON.stringify({ kind: "staff_override", ...payload }), "utf8");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body.toString("base64url")}.${sig}`;
}

/** @returns {{ kind: 'staff_override', branchId: number, exp: number } | null} */
export function parseStaffOverrideToken(token) {
  if (!token || typeof token !== "string") return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const b64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let secret;
  try {
    secret = getSecret();
  } catch {
    return null;
  }
  let body;
  try {
    body = Buffer.from(b64, "base64url");
  } catch {
    return null;
  }
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  try {
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(body.toString("utf8"));
    if (payload.kind !== "staff_override") return null;
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
    if (payload.branchId == null) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getStaffOverrideFromCookies() {
  const c = cookies().get(STAFF_OVERRIDE_COOKIE_NAME)?.value;
  return parseStaffOverrideToken(c);
}

export function staffOverrideCookieOptions() {
  const secure = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SEC
  };
}
