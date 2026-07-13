import { NextResponse } from "next/server";
import { requireStaffOverride } from "@/lib/api-staff-override-guard";
import { fetchBranchBySlug } from "@/lib/branch-server";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function PATCH(_, { params }) {
  const { error: guardErr } = await requireStaffOverride(params.slug);
  if (guardErr) return guardErr;

  const { branch, error: brErr } = await fetchBranchBySlug(params.slug);
  if (brErr || !branch) return NextResponse.json({ error: "Standort nicht gefunden." }, { status: 404 });

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Ungültige Bestell-ID." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("orders")
    .update({ status: "pending", delivered_at: null })
    .eq("id", id)
    .eq("branch_id", branch.id)
    .eq("status", "delivered")
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) {
    return NextResponse.json({ error: "Nur ausgelieferte Bestellungen können zurückgesetzt werden." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, status: "pending" });
}
