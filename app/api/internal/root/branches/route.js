import { NextResponse } from "next/server";
import { requireRootSession } from "@/lib/api-root-guard";
import { normalizeBranchSlug } from "@/lib/internal-session";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error: authErr } = await requireRootSession();
  if (authErr) return authErr;

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("branches")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ branches: data || [] });
}

export async function POST(req) {
  const { error: authErr } = await requireRootSession();
  if (authErr) return authErr;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const name = String(body.name || "").trim();
  const slugRaw = String(body.slug || "").trim();
  const slug = normalizeBranchSlug(slugRaw);
  const isActive = body.is_active !== false;

  if (!name) return NextResponse.json({ error: "Name erforderlich." }, { status: 400 });
  if (!slug) return NextResponse.json({ error: "Gültiger Slug erforderlich (a-z, 0-9, Bindestrich)." }, { status: 400 });

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("branches")
    .insert({ name, slug, is_active: isActive })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Slug bereits vergeben." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ branch: data });
}
