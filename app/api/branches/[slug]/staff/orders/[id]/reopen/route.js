import { NextResponse } from "next/server";
import { requireBranchSession } from "@/lib/api-branch-guard";
import { fetchBranchBySlug } from "@/lib/branch-server";
import { recordOrderEvent, rejectIfCancelled } from "@/lib/order-events";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Reset not_picked_up → pending (Offen). Works for today and tomorrow. */
export async function PATCH(_, { params }) {
  const { error: authErr, session } = await requireBranchSession(params.slug, ["team", "admin"]);
  if (authErr) return authErr;

  const { branch, error: brErr } = await fetchBranchBySlug(params.slug);
  if (brErr || !branch) return NextResponse.json({ error: "Standort nicht gefunden." }, { status: 404 });

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Ungültige Bestell-ID." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const blocked = await rejectIfCancelled(supabase, { id, branchId: branch.id });
  if (blocked) return blocked;
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
    await recordOrderEvent(supabase, { orderId: id, branchId: branch.id, action: "reopen", role: session.role });
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

  await recordOrderEvent(supabase, { orderId: id, branchId: branch.id, action: "reopen", role: session.role });
  return NextResponse.json({ ok: true, status: "pending" });
}
