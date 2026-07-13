import { NextResponse } from "next/server";
import { requireStaffOverride } from "@/lib/api-staff-override-guard";
import { fetchBranchBySlug } from "@/lib/branch-server";
import { isMissingPaidAtColumn } from "@/lib/staff-orders-shared";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function PATCH(req, { params }) {
  const { error: guardErr } = await requireStaffOverride(params.slug);
  if (guardErr) return guardErr;

  const { branch, error: brErr } = await fetchBranchBySlug(params.slug);
  if (brErr || !branch) return NextResponse.json({ error: "Standort nicht gefunden." }, { status: 404 });

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Ungültige Bestell-ID." }, { status: 400 });
  }

  try {
    const body = await req.json();
    if (typeof body.paid !== "boolean") {
      return NextResponse.json({ error: "paid (boolean) erforderlich." }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data: order, error: loadErr } = await supabase
      .from("orders")
      .select("id,status,pickup_date")
      .eq("id", id)
      .eq("branch_id", branch.id)
      .maybeSingle();

    if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
    if (!order) return NextResponse.json({ error: "Bestellung nicht gefunden." }, { status: 404 });
    if (order.status === "not_picked_up") {
      return NextResponse.json({ error: "Zahlung für nicht abgeholte Bestellungen nicht änderbar." }, { status: 400 });
    }

    const patch = { paid_at: body.paid ? new Date().toISOString() : null };
    const { error: updErr } = await supabase
      .from("orders")
      .update(patch)
      .eq("id", id)
      .eq("branch_id", branch.id);

    if (updErr && isMissingPaidAtColumn(updErr)) {
      return NextResponse.json(
        { error: "paid_at Migration fehlt. Bitte 20260602160000_add_orders_paid_at.sql ausführen." },
        { status: 503 }
      );
    }
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, paid: body.paid });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
