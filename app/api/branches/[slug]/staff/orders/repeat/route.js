import { NextResponse } from "next/server";
import { requireBranchSession } from "@/lib/api-branch-guard";
import { fetchBranchBySlug } from "@/lib/branch-server";
import { createStaffRepeatOrder } from "@/lib/staff-repeat-order";
import { isMissingPaidAtColumn } from "@/lib/staff-orders-shared";
import { getSupabaseServerClient } from "@/lib/supabase";
import { tomorrowBerlinDate } from "@/lib/order-utils";

export const dynamic = "force-dynamic";

export async function POST(req, { params }) {
  const { error: authErr } = await requireBranchSession(params.slug, ["team", "admin"]);
  if (authErr) return authErr;

  const { branch, error: brErr } = await fetchBranchBySlug(params.slug);
  if (brErr || !branch) return NextResponse.json({ error: "Standort nicht gefunden." }, { status: 404 });

  try {
    const body = await req.json();
    const sourceOrderId = Number(body.sourceOrderId);
    if (!Number.isInteger(sourceOrderId) || sourceOrderId <= 0) {
      return NextResponse.json({ error: "Ungültige Bestell-ID." }, { status: 400 });
    }

    const pickupDate = String(body.pickupDate || tomorrowBerlinDate());
    const allowedPickup = tomorrowBerlinDate();
    if (pickupDate !== allowedPickup) {
      return NextResponse.json({ error: "Vorbestellung ist nur für morgen möglich." }, { status: 400 });
    }
    const lines = Array.isArray(body.lines) ? body.lines : [];

    const supabase = getSupabaseServerClient();
    const result = await createStaffRepeatOrder(supabase, {
      branchId: branch.id,
      sourceOrderId,
      lines,
      pickupDate
    });

    if (body.paidNow === true && result.orderId) {
      const { error: paidErr } = await supabase
        .from("orders")
        .update({ paid_at: new Date().toISOString() })
        .eq("id", result.orderId)
        .eq("branch_id", branch.id);
      if (paidErr && !isMissingPaidAtColumn(paidErr)) {
        return NextResponse.json({ error: paidErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const status = Number(e?.status) || 500;
    return NextResponse.json({ error: String(e?.message || e) }, { status });
  }
}
