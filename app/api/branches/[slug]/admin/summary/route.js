import { NextResponse } from "next/server";
import { requireBranchSession } from "@/lib/api-branch-guard";
import { fetchBranchBySlug } from "@/lib/branch-server";
import { buildAdminSummaryPayload } from "@/lib/build-admin-summary";
import { fetchOrdersAndItemsForSummary } from "@/lib/fetch-orders-for-summary";
import { getSupabaseServerClient } from "@/lib/supabase";
import { berlinDateFromIso, berlinDateWithOffset, getBerlinNow } from "@/lib/order-utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 120;

export async function GET(_, { params }) {
  const { error: authErr } = await requireBranchSession(params.slug, ["admin"]);
  if (authErr) return authErr;

  const { branch, error: brErr } = await fetchBranchBySlug(params.slug);
  if (brErr || !branch) return NextResponse.json({ error: "Standort nicht gefunden." }, { status: 404 });

  const branchId = branch.id;
  const supabase = getSupabaseServerClient();
  const { date: today } = getBerlinNow();
  const tomorrowPickup = berlinDateWithOffset(1);

  let orders;
  let items;
  try {
    const loaded = await fetchOrdersAndItemsForSummary(supabase, { branchId });
    orders = loaded.orders;
    items = loaded.items;
  } catch (e) {
    const message = String(e?.message || e);
    const status = e?.code === "SUMMARY_LIMIT" ? 413 : 500;
    return NextResponse.json({ error: message }, { status });
  }

  const pendingTomorrowRes = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("branch_id", branchId)
    .eq("pickup_date", tomorrowPickup)
    .eq("status", "pending");

  const { data: regRows, error: regErr } = await supabase
    .from("registrations_analytics")
    .select("created_at")
    .eq("branch_id", branchId);
  if (regErr) return NextResponse.json({ error: regErr.message }, { status: 500 });

  const regs = regRows || [];
  const registrationsToday = regs.filter((r) => berlinDateFromIso(r.created_at) === today).length;
  const byDay = new Map();
  for (const r of regs) {
    const d = berlinDateFromIso(r.created_at);
    byDay.set(d, (byDay.get(d) || 0) + 1);
  }
  const registrationDailyCounts = [...byDay.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 31)
    .map(([date, count]) => ({ date, count }));

  const payload = buildAdminSummaryPayload({
    orders,
    items,
    today,
    pendingTomorrow: pendingTomorrowRes.count || 0,
    registrations: {
      registrationsToday,
      registrationsTotal: regs.length,
      registrationDailyCounts
    }
  });

  return NextResponse.json(payload);
}
