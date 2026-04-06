import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * POST: run DB cleanup for expired intake rows (requires REGISTRATION_INTAKE_CLEANUP_SECRET).
 * Intended for cron / manual maintenance — not for guests.
 */
export async function POST(req) {
  const secret = process.env.REGISTRATION_INTAKE_CLEANUP_SECRET;
  if (!secret || secret.length < 8) {
    return NextResponse.json({ error: "Cleanup nicht konfiguriert." }, { status: 503 });
  }

  const auth = req.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (bearer !== secret) {
    return NextResponse.json({ error: "Nicht berechtigt." }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc("cleanup_expired_registrations_intake");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, deleted_intake_rows: data ?? 0 });
}
