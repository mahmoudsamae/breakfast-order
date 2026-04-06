import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireRootSession } from "@/lib/api-root-guard";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function parseId(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null;
  return n;
}

export async function PATCH(req, { params }) {
  const { error: authErr } = await requireRootSession();
  if (authErr) return authErr;

  const credId = parseId(params.id);
  if (credId == null) return NextResponse.json({ error: "Ungültige ID." }, { status: 400 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const patch = {};
  if (body.username != null) {
    const username = String(body.username).trim().toLowerCase();
    if (!username) return NextResponse.json({ error: "Benutzername darf nicht leer sein." }, { status: 400 });
    patch.username = username;
  }
  if (body.password != null) {
    const password = String(body.password);
    if (password.length < 8) return NextResponse.json({ error: "Passwort mindestens 8 Zeichen." }, { status: 400 });
    patch.password_hash = await bcrypt.hash(password, 12);
  }
  if (body.is_active != null) {
    patch.is_active = Boolean(body.is_active);
  }
  if (body.role != null) {
    const role = body.role === "admin" ? "admin" : "team";
    patch.role = role;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Keine Änderungen." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("branch_credentials")
    .update(patch)
    .eq("id", credId)
    .select("id,branch_id,username,role,is_active,created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Benutzername an diesem Standort schon vergeben." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });
  return NextResponse.json({ credential: data });
}
