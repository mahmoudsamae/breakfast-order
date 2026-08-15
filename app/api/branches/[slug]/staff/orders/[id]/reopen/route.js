import { NextResponse } from "next/server";
import { requireStaffOverride } from "@/lib/api-staff-override-guard";
import { fetchBranchBySlug } from "@/lib/branch-server";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * PIN-gated: reset not_picked_up → pending (Offen).
 * Works for today and tomorrow (to fix accidental noshow marks).
 */
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
  const withReason = await supabase
    .from("orders")
    .update({
      status: "pending",
      not_picked_up_reason: null,
      not_picked_up_note: null
    })
    .eq("id", id)
    .eq("branch_id", branch.id)
    .eq("status", "not_picked_up")
    .select("id")
    .maybeSingle();

  if (!withReason.error && withReason.data) {
    return NextResponse.json({ ok: true, status: "pending" });
  }

  const missingReasonCols =
    withReason.error &&
    (withReason.error.code === "42703" ||
      String(withReason.error.message || "").includes("not_picked_up_reason") ||
      String(withReason.error.message || "").includes("not_picked_up_note"));

  if (withReason.error && !missingReasonCols) {
    return NextResponse.json({ error: withReason.error.message }, { status: 500 });
  }

  const fallback = await supabase
    .from("orders")
    .update({ status: "pending" })
    .eq("id", id)
    .eq("branch_id", branch.id)
    .eq("status", "not_picked_up")
    .select("id")
    .maybeSingle();

  if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 500 });
  if (!fallback.data) {
    return NextResponse.json(
      { error: "Nur „Nicht abgeholt“-Bestellungen können wieder geöffnet werden." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, status: "pending" });
}
