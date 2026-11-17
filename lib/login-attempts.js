import { createHash } from "crypto";
import { getSupabaseServerClient } from "@/lib/supabase";

const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

export const INVALID_LOGIN_MESSAGE = "Ungültige Zugangsdaten.";
export const LOGIN_LOCKED_MESSAGE = "Zu viele Versuche. Bitte in 15 Minuten erneut versuchen.";

function isMissingAttemptsTable(error) {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return String(error.message || "").includes("login_attempts");
}

/** SHA-256 hex of the client IP. Returns null when the request has no address. */
export function clientIpHashFromRequest(req) {
  const forwarded = req.headers.get("x-forwarded-for");
  const raw = forwarded ? forwarded.split(",")[0].trim() : String(req.headers.get("x-real-ip") || "").trim();
  if (!raw) return null;
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

function sinceIso() {
  return new Date(Date.now() - WINDOW_MS).toISOString();
}

function applyUserKey(query, { scope, branchId, username }) {
  let next = query.eq("scope", scope).eq("username", username);
  if (scope === "branch") return next.eq("branch_id", branchId);
  return next.is("branch_id", null);
}

async function countRows(build) {
  let query = getSupabaseServerClient()
    .from("login_attempts")
    .select("id", { count: "exact", head: true });
  query = build(query);
  const { count, error } = await query;
  if (error) {
    if (isMissingAttemptsTable(error)) return { missing: true, count: 0 };
    throw error;
  }
  return { missing: false, count: count || 0 };
}

/**
 * True when this username (and branch, for staff login) or this IP hash
 * is inside a 15-minute lock started by 5 failures.
 */
export async function loginIsBlocked({ scope, branchId = null, username, ipHash = null }) {
  const nowIso = new Date().toISOString();
  const userLock = await countRows((query) =>
    applyUserKey(query, { scope, branchId, username }).gt("locked_until", nowIso)
  );
  if (userLock.missing) return false;
  if (userLock.count > 0) return true;
  if (!ipHash) return false;

  const ipLock = await countRows((query) => query.eq("ip_hash", ipHash).gt("locked_until", nowIso));
  if (ipLock.missing) return false;
  return ipLock.count > 0;
}

async function lockRecent(build) {
  const recent = await countRows((query) => build(query).gte("created_at", sinceIso()));
  if (recent.missing || recent.count < MAX_FAILURES) return;
  const lockedUntil = new Date(Date.now() + LOCK_MS).toISOString();
  let update = getSupabaseServerClient()
    .from("login_attempts")
    .update({ locked_until: lockedUntil })
    .gte("created_at", sinceIso());
  update = build(update);
  const { error } = await update;
  if (error && !isMissingAttemptsTable(error)) throw error;
}

export async function recordLoginFailure({ scope, branchId = null, username, ipHash = null }) {
  const { error } = await getSupabaseServerClient().from("login_attempts").insert({
    scope,
    branch_id: scope === "branch" ? branchId : null,
    username: String(username).slice(0, 200),
    ip_hash: ipHash
  });
  if (error) {
    if (isMissingAttemptsTable(error)) return;
    throw error;
  }

  await lockRecent((query) => applyUserKey(query, { scope, branchId, username }));
  if (ipHash) {
    await lockRecent((query) => query.eq("ip_hash", ipHash));
  }
}

export async function clearLoginFailuresForUser({ scope, branchId = null, username }) {
  let query = getSupabaseServerClient().from("login_attempts").delete().eq("scope", scope).eq("username", username);
  query = scope === "branch" ? query.eq("branch_id", branchId) : query.is("branch_id", null);
  const { error } = await query;
  if (error && !isMissingAttemptsTable(error)) throw error;
}
