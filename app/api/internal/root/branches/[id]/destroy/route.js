import { NextResponse } from "next/server";
import { requireRootSession } from "@/lib/api-root-guard";
import { deleteBranchCascade } from "@/lib/delete-branch-cascade";
import { normalizeBranchSlug } from "@/lib/branch-slug";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function parseId(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null;
  return n;
}

/**
 * Permanent branch removal. Body: { confirmSlug: string } must match the branch slug (normalized).
 */
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

  const confirmSlug = normalizeBranchSlug(String(body.confirmSlug || ""));
  if (!confirmSlug) {
    return NextResponse.json({ error: "Slug-Bestätigung erforderlich." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const { data: branch, error: fetchErr } = await supabase
    .from("branches")
    .select("id,slug")
    .eq("id", branchId)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!branch) return NextResponse.json({ error: "Standort nicht gefunden." }, { status: 404 });

  if (normalizeBranchSlug(branch.slug) !== confirmSlug) {
    return NextResponse.json({ error: "Slug-Bestätigung stimmt nicht mit diesem Standort überein." }, { status: 400 });
  }

  try {
    await deleteBranchCascade(supabase, branchId);
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
