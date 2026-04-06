import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireRootSession } from "@/lib/api-root-guard";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const MIN_LEN = 8;

export async function POST(req) {
  const { error: authErr, session } = await requireRootSession();
  if (authErr) return authErr;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const currentPassword = String(body.currentPassword || "");
  const newPassword = String(body.newPassword || "");

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Aktuelles und neues Passwort erforderlich." }, { status: 400 });
  }
  if (newPassword.length < MIN_LEN) {
    return NextResponse.json({ error: `Neues Passwort mindestens ${MIN_LEN} Zeichen.` }, { status: 400 });
  }
  if (newPassword === currentPassword) {
    return NextResponse.json({ error: "Neues Passwort muss sich vom aktuellen unterscheiden." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const id = Number(session.rootAdminId);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Ungültige Sitzung." }, { status: 401 });
  }

  const { data: row, error: fetchErr } = await supabase
    .from("root_admins")
    .select("id,password_hash,is_active")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!row?.password_hash || !row.is_active) {
    return NextResponse.json({ error: "Konto nicht gefunden oder deaktiviert." }, { status: 403 });
  }

  const ok = await bcrypt.compare(currentPassword, row.password_hash);
  if (!ok) {
    return NextResponse.json({ error: "Aktuelles Passwort ist falsch." }, { status: 401 });
  }

  const password_hash = await bcrypt.hash(newPassword, 12);
  const { error: updErr } = await supabase.from("root_admins").update({ password_hash }).eq("id", id);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
