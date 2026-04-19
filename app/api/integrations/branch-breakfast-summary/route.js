import { NextResponse } from "next/server";
import { fetchBranchBySlug } from "@/lib/branch-server";
import { normalizeBranchSlug } from "@/lib/branch-slug";
import { getSupabaseServerClient } from "@/lib/supabase";
import { berlinDateFromIso, berlinDateWithOffset, berlinHourFromIso, getBerlinNow } from "@/lib/order-utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const RANGE_VALUES = new Set(["today", "yesterday", "last7days", "last30days"]);

/** Minimal nested select; matches admin summary aggregation (product + menu lines). */
const ORDERS_SELECT =
  "id,created_at,order_items(quantity,products(name),menus(name))";

/**
 * ordersFromRegistration: null — orders do not store registration_number; breakfast_ordered on
 * registrations_analytics has no reliable "order placed at" timestamp for range filtering.
 *
 * savedReceptionMinutes, feedback*, unpaidCheckouts, departuresTomorrowUnpaid: null — no persisted
 * metrics / columns for these in the current schema (no feedback table, no order payment state).
 */

function berlinDateInRange(ymd, startYmd, endYmd) {
  if (!ymd) return false;
  return ymd >= startYmd && ymd <= endYmd;
}

function rangeToWindow(range) {
  const { date: today } = getBerlinNow();
  switch (range) {
    case "today":
      return { startYmd: today, endYmd: today };
    case "yesterday": {
      const y = berlinDateWithOffset(-1);
      return { startYmd: y, endYmd: y };
    }
    case "last7days":
      return { startYmd: berlinDateWithOffset(-6), endYmd: today };
    case "last30days":
      return { startYmd: berlinDateWithOffset(-29), endYmd: today };
    default:
      return null;
  }
}

function aggregateProductsAndMenus(orderRows, startYmd, endYmd) {
  const counts = new Map();
  for (const o of orderRows || []) {
    const d = berlinDateFromIso(o.created_at);
    if (!berlinDateInRange(d, startYmd, endYmd)) continue;
    for (const i of o.order_items || []) {
      const q = Number(i.quantity || 0);
      if (q <= 0) continue;
      const pn = i.products?.name;
      const mn = i.menus?.name;
      if (pn) counts.set(pn, (counts.get(pn) || 0) + q);
      if (mn) counts.set(mn, (counts.get(mn) || 0) + q);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "de"));
}

function countOrdersInWindow(orderRows, startYmd, endYmd) {
  let n = 0;
  for (const o of orderRows || []) {
    const d = berlinDateFromIso(o.created_at);
    if (berlinDateInRange(d, startYmd, endYmd)) n += 1;
  }
  return n;
}

function countOrders18to21(orderRows, startYmd, endYmd) {
  let n = 0;
  for (const o of orderRows || []) {
    const d = berlinDateFromIso(o.created_at);
    if (!berlinDateInRange(d, startYmd, endYmd)) continue;
    const h = berlinHourFromIso(o.created_at);
    if (h != null && h >= 18 && h <= 21) n += 1;
  }
  return n;
}

export async function GET(req) {
  try {
    const expected = process.env.BRANCHWISE_INTEGRATION_TOKEN;
    if (expected == null || String(expected).trim() === "") {
      return NextResponse.json({ ok: false, error: "integration_unconfigured" }, { status: 503 });
    }
    const token = req.headers.get("x-integration-token");
    if (!token || token !== expected) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const branchRaw = url.searchParams.get("branch");
    const slug = normalizeBranchSlug(branchRaw || "");
    if (!slug) {
      return NextResponse.json({ ok: false, error: "branch_required" }, { status: 400 });
    }

    const rangeRaw = (url.searchParams.get("range") || "today").toLowerCase();
    const range = RANGE_VALUES.has(rangeRaw) ? rangeRaw : null;
    if (!range) {
      return NextResponse.json({ ok: false, error: "invalid_range" }, { status: 400 });
    }

    const window = rangeToWindow(range);
    if (!window) {
      return NextResponse.json({ ok: false, error: "invalid_range" }, { status: 400 });
    }

    const { branch, error: brErr } = await fetchBranchBySlug(slug);
    if (brErr || !branch) {
      return NextResponse.json({ ok: false, error: "branch_not_found" }, { status: 404 });
    }

    const { date: today } = getBerlinNow();
    const last7Start = berlinDateWithOffset(-6);
    /** Wall-clock lookback (covers last30days + buffer); filtered by Berlin date in memory. */
    const fetchCutoffIso = new Date(Date.now() - 41 * 86400000).toISOString();

    const supabase = getSupabaseServerClient();
    const { data: orderRows, error: ordersErr } = await supabase
      .from("orders")
      .select(ORDERS_SELECT)
      .eq("branch_id", branch.id)
      .gte("created_at", fetchCutoffIso)
      .order("created_at", { ascending: true })
      .limit(20000);

    if (ordersErr) {
      return NextResponse.json({ ok: false, error: "query_failed" }, { status: 500 });
    }

    const rows = orderRows || [];

    const ordersToday = countOrdersInWindow(rows, today, today);
    const ordersLast7Days = countOrdersInWindow(rows, last7Start, today);

    const ordersBetween18And21 = countOrders18to21(rows, window.startYmd, window.endYmd);
    const ordersByProduct = aggregateProductsAndMenus(rows, window.startYmd, window.endYmd);

    const generatedAt = new Date().toISOString();

    return NextResponse.json({
      ok: true,
      branch: branch.slug,
      range,
      generatedAt,
      data: {
        ordersToday,
        ordersLast7Days,
        ordersFromRegistration: null,
        ordersBetween18And21,
        ordersByProduct,
        savedReceptionMinutes: null,
        positiveFeedbackCount: null,
        negativeFeedbackCount: null,
        topPositiveKeywords: null,
        topNegativeKeywords: null,
        unpaidCheckouts: null,
        departuresTomorrowUnpaid: null
      }
    });
  } catch {
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
