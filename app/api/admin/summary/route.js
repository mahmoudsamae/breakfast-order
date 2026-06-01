import { NextResponse } from "next/server";
import { requireAdminCookie } from "@/lib/admin-api-guard";
import { buildAdminSummaryPayload } from "@/lib/build-admin-summary";
import { fetchOrdersAndItemsForSummary } from "@/lib/fetch-orders-for-summary";
import { getSupabaseServerClient } from "@/lib/supabase";
import { berlinDateWithOffset, getBerlinNow } from "@/lib/order-utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 120;

export async function GET() {
  const unauthorized = requireAdminCookie();
  if (unauthorized) return unauthorized;
  const supabase = getSupabaseServerClient();
  const { date: today } = getBerlinNow();
  const tomorrowPickup = berlinDateWithOffset(1);

  let orders;
  let items;
  try {
    const loaded = await fetchOrdersAndItemsForSummary(supabase);
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
    .eq("pickup_date", tomorrowPickup)
    .eq("status", "pending");

  const payload = buildAdminSummaryPayload({
    orders,
    items,
    today,
    pendingTomorrow: pendingTomorrowRes.count || 0
  });

  return NextResponse.json(payload);
}
