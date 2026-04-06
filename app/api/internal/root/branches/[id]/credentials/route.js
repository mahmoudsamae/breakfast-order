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

export async function GET(_req, { params }) {
  const { error: authErr } = await requireRootSession();
  if (authErr) return authErr;

  const branchId = parseId(params.id);
  if (branchId == null) return NextResponse.json({ error: "Ungültige ID." }, { status: 400 });

  const supabase = getSupabaseServerClient();
  const { data: branch, error: brErr } = await supabase.from("branches").select("id").eq("id", branchId).maybeSingle();
  if (brErr) return NextResponse.json({ error: brErr.message }, { status: 500 });
  if (!branch) return NextResponse.json({ error: "Standort nicht gefunden." }, { status: 404 });

  const { data, error } = await supabase
    .from("branch_credentials")
    .select("id,branch_id,username,role,is_active,created_at")
    .eq("branch_id", branchId)
    .order("username");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ credentials: data || [] });
}

export async function POST(req, { params }) {
  const { error: authErr } = await requireRootSession();
  if (authErr) return authErr;

  const branchId = parseId(params.id);
  if (branchId == null) return NextResponse.json({ error: "Ungültige ID." }, { status: 400 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const username = String(body.username || "")
    .trim()
    .toLowerCase();
  const password = String(body.password || "");
  const role = body.role === "admin" ? "admin" : "team";

  if (!username) return NextResponse.json({ error: "Benutzername erforderlich." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Passwort mindestens 8 Zeichen." }, { status: 400 });

  const supabase = getSupabaseServerClient();
  const { data: branch, error: brErr } = await supabase.from("branches").select("id").eq("id", branchId).maybeSingle();
  if (brErr) return NextResponse.json({ error: brErr.message }, { status: 500 });
  if (!branch) return NextResponse.json({ error: "Standort nicht gefunden." }, { status: 404 });

  const password_hash = await bcrypt.hash(password, 12);
  const { data, error } = await supabase
    .from("branch_credentials")
    .insert({ branch_id: branchId, username, password_hash, role, is_active: true })
    .select("id,branch_id,username,role,is_active,created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Benutzername an diesem Standort schon vergeben." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ credential: data });
}
