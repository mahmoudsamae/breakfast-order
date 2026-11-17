import { NextResponse } from "next/server";
import { requireBranchSession } from "@/lib/api-branch-guard";
import { fetchBranchBySlug } from "@/lib/branch-server";
import { recordOrderEvent } from "@/lib/order-events";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Permanent delete. Admin only, and only after the order was cancelled.
 * order_items reference orders with ON DELETE RESTRICT — delete items first.
 * The audit row keeps branch_id; order_id becomes null.
 */
export async function DELETE(_req, { params }) {
  const { error: authErr, session } = await requireBranchSession(params.slug, ["admin"]);
  if (authErr) return authErr;

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
      .select("id,order_number,cancelled_at")
      .eq("id", id)
      .eq("branch_id", branch.id)
      .maybeSingle();

    if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
    if (!order) return NextResponse.json({ error: "Bestellung nicht gefunden." }, { status: 404 });
    if (!order.cancelled_at) {
      return NextResponse.json({ error: "Nur stornierte Bestellungen können endgültig gelöscht werden." }, { status: 409 });
    }

    await recordOrderEvent(supabase, {
      orderId: id,
      branchId: branch.id,
      action: "delete",
      role: session.role,
      details: { orderNumber: order.order_number ?? null }
    });

    const { error: itemsErr } = await supabase.from("order_items").delete().eq("order_id", id);
    if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 });

    const { error: ordErr } = await supabase.from("orders").delete().eq("id", id).eq("branch_id", branch.id);
    if (ordErr) return NextResponse.json({ error: ordErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, deleted: true, orderNumber: order.order_number ?? null });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
