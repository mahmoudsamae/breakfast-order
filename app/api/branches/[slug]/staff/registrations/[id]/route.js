import { NextResponse } from "next/server";
import { requireBranchSession } from "@/lib/api-branch-guard";
import { fetchBranchBySlug } from "@/lib/branch-server";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function parseId(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null;
  return n;
}

/**
 * DELETE: remove intake row (PII) and set processed_at on analytics for the same registration_number.
 */
export async function DELETE(_, { params }) {
  const { error: authErr } = await requireBranchSession(params.slug, ["team", "admin"]);
  if (authErr) return authErr;

  const { branch, error: brErr } = await fetchBranchBySlug(params.slug);
  if (brErr || !branch) return NextResponse.json({ error: "Standort nicht gefunden." }, { status: 404 });

  const regId = parseId(params.id);
  if (regId == null) return NextResponse.json({ error: "Ungültige ID." }, { status: 400 });

  const supabase = getSupabaseServerClient();
  const processed_at = new Date().toISOString();

  const { data: deleted, error: delErr } = await supabase
    .from("registrations_intake")
    .delete()
    .eq("id", regId)
    .eq("branch_id", branch.id)
    .select("id,registration_number")
    .maybeSingle();

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  if (!deleted) return NextResponse.json({ error: "Eintrag nicht gefunden." }, { status: 404 });

  const rn = deleted.registration_number;
  const { error: updErr } = await supabase
    .from("registrations_analytics")
    .update({ processed_at })
    .eq("branch_id", branch.id)
    .eq("registration_number", rn)
    .is("processed_at", null);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    registration_number: rn,
    processed_at
  });
}
