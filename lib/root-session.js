import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

/** HttpOnly cookie for system owner (separate from branch internal session). */
export const ROOT_SESSION_COOKIE_NAME = "fb_root_session";

const MAX_AGE_SEC = 60 * 60 * 24 * 7;

function getSecret() {
  const s = process.env.ROOT_SESSION_SECRET;
  if (!s || String(s).length < 16) {
    throw new Error("ROOT_SESSION_SECRET must be set (min 16 characters)");
  }
  return String(s);
}

/**
 * @param {{ kind: 'root', rootAdminId: number, username: string, exp: number }} payload
 */
export function createRootSessionToken(payload) {
  const secret = getSecret();
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body.toString("base64url")}.${sig}`;
}

/** @returns {{ kind: 'root', rootAdminId: number, username: string, exp: number } | null} */
export function parseRootSessionToken(token) {
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
    if (payload.kind !== "root") return null;
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
    if (payload.rootAdminId == null || payload.username == null) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getRootSessionFromCookies() {
  const c = cookies().get(ROOT_SESSION_COOKIE_NAME)?.value;
  return parseRootSessionToken(c);
}

export function rootSessionCookieOptions() {
  const secure = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SEC
  };
}
