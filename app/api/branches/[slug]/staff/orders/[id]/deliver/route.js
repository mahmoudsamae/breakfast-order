import { NextResponse } from "next/server";
import { requireBranchSession } from "@/lib/api-branch-guard";
import { fetchBranchBySlug } from "@/lib/branch-server";
import { getBerlinNow } from "@/lib/order-utils";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function PATCH(_, { params }) {
  const { error: authErr } = await requireBranchSession(params.slug, ["team", "admin"]);
  if (authErr) return authErr;

  const { branch, error: brErr } = await fetchBranchBySlug(params.slug);
  if (brErr || !branch) return NextResponse.json({ error: "Standort nicht gefunden." }, { status: 404 });

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Ungültige Bestell-ID." }, { status: 400 });

  const supabase = getSupabaseServerClient();
  const { data: order, error: fetchErr } = await supabase
    .from("orders")
    .select("id, status, pickup_date")
    .eq("id", id)
    .eq("branch_id", branch.id)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!order) return NextResponse.json({ error: "Bestellung nicht gefunden." }, { status: 404 });
  if (order.status !== "pending") {
    return NextResponse.json({ error: "Nur offene Bestellungen können ausgeliefert werden." }, { status: 400 });
  }

  const { date: todayBerlin } = getBerlinNow();
  const pickupYmd = String(order.pickup_date || "").slice(0, 10);
  if (pickupYmd !== todayBerlin) {
    return NextResponse.json(
      { error: "Auslieferung ist erst am Abholtag möglich (nicht für Bestellungen von morgen)." },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("orders")
    .update({ status: "delivered", delivered_at: new Date().toISOString() })
    .eq("id", id)
    .eq("branch_id", branch.id)
    .eq("status", "pending");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
