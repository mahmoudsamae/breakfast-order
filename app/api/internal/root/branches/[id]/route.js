import { NextResponse } from "next/server";
import { requireRootSession } from "@/lib/api-root-guard";
import { normalizeBranchSlug } from "@/lib/internal-session";
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

  const id = parseId(params.id);
  if (id == null) return NextResponse.json({ error: "Ungültige ID." }, { status: 400 });

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("branches").select("*").eq("id", id).maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });
  return NextResponse.json({ branch: data });
}

export async function PATCH(req, { params }) {
  const { error: authErr } = await requireRootSession();
  if (authErr) return authErr;

  const id = parseId(params.id);
  if (id == null) return NextResponse.json({ error: "Ungültige ID." }, { status: 400 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const patch = {};
  if (body.name != null) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "Name darf nicht leer sein." }, { status: 400 });
    patch.name = name;
  }
  if (body.slug != null) {
    const slug = normalizeBranchSlug(String(body.slug));
    if (!slug) return NextResponse.json({ error: "Ungültiger Slug." }, { status: 400 });
    patch.slug = slug;
  }
  if (body.is_active != null) {
    patch.is_active = Boolean(body.is_active);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Keine Änderungen." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("branches").update(patch).eq("id", id).select("*").single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Slug bereits vergeben." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });
  return NextResponse.json({ branch: data });
}
