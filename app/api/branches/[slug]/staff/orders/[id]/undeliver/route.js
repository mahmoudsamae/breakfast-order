import { NextResponse } from "next/server";
import { requireBranchSession } from "@/lib/api-branch-guard";
import { fetchBranchBySlug } from "@/lib/branch-server";
import { recordOrderEvent, rejectIfCancelled } from "@/lib/order-events";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

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

  await recordOrderEvent(supabase, { orderId: id, branchId: branch.id, action: "undeliver", role: session.role });
  return NextResponse.json({ ok: true, status: "pending" });
}
