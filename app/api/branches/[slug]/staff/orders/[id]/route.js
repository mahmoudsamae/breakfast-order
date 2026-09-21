import { NextResponse } from "next/server";
import { requireStaffOverride } from "@/lib/api-staff-override-guard";
import { fetchBranchBySlug } from "@/lib/branch-server";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Permanent delete of one order (+ its order_items). Override PIN required.
 * order_items reference orders with ON DELETE RESTRICT — delete items first.
 */
export async function DELETE(_req, { params }) {
  const { error: guardErr } = await requireStaffOverride(params.slug);
  if (guardErr) return guardErr;

  const { branch, error: brErr } = await fetchBranchBySlug(params.slug);
  if (brErr || !branch) return NextResponse.json({ error: "Standort nicht gefunden." }, { status: 404 });

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Ungültige Bestell-ID." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const { data: order, error: loadErr } = await supabase
      .from("orders")
      .select("id,order_number")
      .eq("id", id)
      .eq("branch_id", branch.id)
      .maybeSingle();

    if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
    if (!order) return NextResponse.json({ error: "Bestellung nicht gefunden." }, { status: 404 });

    const { error: itemsErr } = await supabase.from("order_items").delete().eq("order_id", id);
    if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 });

    const { error: ordErr } = await supabase.from("orders").delete().eq("id", id).eq("branch_id", branch.id);
    if (ordErr) return NextResponse.json({ error: ordErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, deleted: true, orderNumber: order.order_number ?? null });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
