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
  "id,created_at,total_amount,order_items(quantity,unit_price,products(name,category),menus(name))";

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

function addBerlinDays(ymd, n) {
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  const u = Date.UTC(y, m - 1, d + n, 12, 0, 0);
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(u));
  const map = Object.fromEntries(p.map((x) => [x.type, x.value]));
  return `${map.year}-${map.month}-${map.day}`;
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

function pctChange(current, prev) {
  if (!Number.isFinite(current) || !Number.isFinite(prev)) return null;
  if (prev === 0) return current === 0 ? 0 : null;
  return Math.round(((current - prev) / prev) * 1000) / 10;
}

function mapOrdersForAnalytics(orderRows) {
  return (orderRows || []).map((o) => {
    const dateYmd = berlinDateFromIso(o.created_at);
    const hour = berlinHourFromIso(o.created_at);
    const totalAmount = Number(o.total_amount || 0);
    const productUnits = new Map();
    const productRevenue = new Map();
    let totalItems = 0;

    for (const i of o.order_items || []) {
      const q = Number(i.quantity || 0);
      if (q <= 0) continue;
      totalItems += q;
      const unitPrice = Number(i.unit_price || 0);
      const lineRevenue = q * unitPrice;
      const pn = i.products?.name;
      const pc = i.products?.category || null;
      const mn = i.menus?.name;
      if (pn) {
        productUnits.set(pn, (productUnits.get(pn) || 0) + q);
        productRevenue.set(pn, (productRevenue.get(pn) || 0) + lineRevenue);
      }
      if (mn) {
        productUnits.set(mn, (productUnits.get(mn) || 0) + q);
        productRevenue.set(mn, (productRevenue.get(mn) || 0) + lineRevenue);
      }
    }

    return {
      id: o.id,
      dateYmd,
      hour,
      totalAmount,
      totalItems,
      productUnits,
      productRevenue,
      orderItems: (o.order_items || []).map((i) => ({
        quantity: Number(i.quantity || 0),
        unitPrice: Number(i.unit_price || 0),
        productName: i.products?.name || null,
        productCategory: i.products?.category || null,
        menuName: i.menus?.name || null
      }))
    };
  });
}

function aggregatePastryProducts(rows) {
  const units = new Map();
  const revenue = new Map();
  for (const o of rows) {
    for (const i of o.orderItems || []) {
      if (!i.productName) continue;
      if (String(i.productCategory || "").toLowerCase() === "getraenke") continue;
      if (i.quantity <= 0) continue;
      units.set(i.productName, (units.get(i.productName) || 0) + i.quantity);
      revenue.set(i.productName, (revenue.get(i.productName) || 0) + i.quantity * i.unitPrice);
    }
  }
  return [...units.entries()]
    .map(([name, quantitySold]) => ({
      name,
      quantitySold,
      totalRevenue: Math.round((revenue.get(name) || 0) * 100) / 100
    }))
    .sort((a, b) => b.quantitySold - a.quantitySold || a.name.localeCompare(b.name, "de"));
}

function aggregateWindow(rows, startYmd, endYmd) {
  const byHour = new Array(24).fill(0);
  const byDay = new Map();
  const productUnits = new Map();
  const productRevenue = new Map();
  const productOrderSet = new Map();
  let ordersCount = 0;
  let orders18to21 = 0;
  let itemsSold = 0;
  let revenue = 0;

  for (const o of rows) {
    if (!berlinDateInRange(o.dateYmd, startYmd, endYmd)) continue;
    ordersCount += 1;
    itemsSold += o.totalItems;
    revenue += o.totalAmount;
    byDay.set(o.dateYmd, (byDay.get(o.dateYmd) || 0) + 1);
    if (o.hour != null) {
      byHour[o.hour] += 1;
      if (o.hour >= 18 && o.hour <= 21) orders18to21 += 1;
    }
    for (const [name, qty] of o.productUnits.entries()) {
      productUnits.set(name, (productUnits.get(name) || 0) + qty);
      if (!productOrderSet.has(name)) productOrderSet.set(name, new Set());
      productOrderSet.get(name).add(o.id);
    }
    for (const [name, amount] of o.productRevenue.entries()) {
      productRevenue.set(name, (productRevenue.get(name) || 0) + amount);
    }
  }

  const ordersByHour = byHour.map((count, hour) => ({ hour, count }));
  const ordersByDay = [...byDay.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const revenuePerDay = [...ordersByDay].map(({ date }) => ({ date, revenue: 0 }));
  const revenueByDayMap = new Map(revenuePerDay.map((x) => [x.date, 0]));
  const revenueByHour = new Array(24).fill(0);

  for (const o of rows) {
    if (!berlinDateInRange(o.dateYmd, startYmd, endYmd)) continue;
    revenueByDayMap.set(o.dateYmd, (revenueByDayMap.get(o.dateYmd) || 0) + o.totalAmount);
    if (o.hour != null) revenueByHour[o.hour] += o.totalAmount;
  }

  const revenueByDay = [...revenueByDayMap.entries()]
    .map(([date, amount]) => ({ date, revenue: Math.round(amount * 100) / 100 }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const revenueByHourList = revenueByHour.map((amount, hour) => ({ hour, revenue: Math.round(amount * 100) / 100 }));

  const productsBreakdown = [...productUnits.entries()]
    .map(([name, units]) => {
      const rev = Number(productRevenue.get(name) || 0);
      const orderCount = productOrderSet.get(name)?.size || 0;
      return {
        name,
        count: units,
        revenue: Math.round(rev * 100) / 100,
        shareOfSalesPct: revenue > 0 ? Math.round((rev / revenue) * 1000) / 10 : 0,
        shareOfOrdersPct: ordersCount > 0 ? Math.round((orderCount / ordersCount) * 1000) / 10 : 0
      };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "de"));
  const revenueByProduct = [...productsBreakdown]
    .map((x) => ({ name: x.name, revenue: x.revenue }))
    .sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name, "de"));

  const topProducts = productsBreakdown.slice(0, 5).map((x) => ({ name: x.name, count: x.count }));
  const topRevenueProducts = revenueByProduct.slice(0, 5);

  const peakHour = ordersByHour.reduce((best, x) => (x.count > best.count ? x : best), { hour: null, count: -1 });
  const peakDay = ordersByDay.reduce((best, x) => (x.count > best.count ? x : best), { date: null, count: -1 });
  const peakRevenueHour = revenueByHourList.reduce(
    (best, x) => (x.revenue > best.revenue ? x : best),
    { hour: null, revenue: -1 }
  );
  const peakRevenueDay = revenueByDay.reduce((best, x) => (x.revenue > best.revenue ? x : best), { date: null, revenue: -1 });

  return {
    ordersCount,
    orders18to21,
    itemsSold,
    revenue: Math.round(revenue * 100) / 100,
    ordersByHour,
    ordersByDay,
    productsBreakdown,
    revenueByProduct,
    topProducts,
    topRevenueProducts,
    revenuePerDay: revenueByDay,
    revenuePerHour: revenueByHourList,
    peakHour: peakHour.count >= 0 ? peakHour : null,
    peakDay: peakDay.count >= 0 ? peakDay : null,
    peakRevenueHour: peakRevenueHour.revenue >= 0 ? peakRevenueHour : null,
    peakRevenueDay: peakRevenueDay.revenue >= 0 ? peakRevenueDay : null
  };
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
    const yesterday = berlinDateWithOffset(-1);
    const last7Start = berlinDateWithOffset(-6);
    const last30Start = berlinDateWithOffset(-29);
    const prev7Start = berlinDateWithOffset(-13);
    const prev7End = berlinDateWithOffset(-7);
    const prev30Start = berlinDateWithOffset(-59);
    const prev30End = berlinDateWithOffset(-30);

    const supabase = getSupabaseServerClient();
    const [{ data: orderRows, error: ordersErr }, { data: regRows, error: regErr }] = await Promise.all([
      supabase
      .from("orders")
      .select(ORDERS_SELECT)
      .eq("branch_id", branch.id)
      .order("created_at", { ascending: true }),
      supabase
        .from("registrations_analytics")
        .select("created_at,breakfast_ordered")
        .eq("branch_id", branch.id)
        .order("created_at", { ascending: true })
    ]);

    if (ordersErr || regErr) {
      return NextResponse.json({ ok: false, error: "query_failed" }, { status: 500 });
    }

    const rows = mapOrdersForAnalytics(orderRows || []);
    const allTimeAgg = aggregateWindow(rows, "0000-01-01", "9999-12-31");
    const pastryAllTime = aggregatePastryProducts(rows);
    const topProductsAllTime = pastryAllTime.slice(0, 4);
    const topSellingProductAllTime = topProductsAllTime[0] || null;
    const regs = regRows || [];
    const selectedAgg = aggregateWindow(rows, window.startYmd, window.endYmd);
    const todayAgg = aggregateWindow(rows, today, today);
    const yesterdayAgg = aggregateWindow(rows, yesterday, yesterday);
    const last7Agg = aggregateWindow(rows, last7Start, today);
    const last30Agg = aggregateWindow(rows, last30Start, today);
    const prev7Agg = aggregateWindow(rows, prev7Start, prev7End);
    const prev30Agg = aggregateWindow(rows, prev30Start, prev30End);

    const registrationsIn = (startYmd, endYmd) => {
      const inWindow = (regs || []).filter((r) => berlinDateInRange(berlinDateFromIso(r.created_at), startYmd, endYmd));
      const breakfastTrue = inWindow.filter((r) => Boolean(r.breakfast_ordered)).length;
      return { forms: inWindow.length, breakfastTrue };
    };
    const regToday = registrationsIn(today, today);
    const regYesterday = registrationsIn(yesterday, yesterday);
    const regLast7 = registrationsIn(last7Start, today);
    const regLast30 = registrationsIn(last30Start, today);
    const regSelected = registrationsIn(window.startYmd, window.endYmd);

    const strongestProduct = selectedAgg.productsBreakdown[0] || null;
    const weakestProduct = selectedAgg.productsBreakdown.length
      ? [...selectedAgg.productsBreakdown].filter((x) => x.count > 0).sort((a, b) => a.count - b.count)[0] || null
      : null;
    const growthMap = new Map();
    for (const x of prev7Agg.productsBreakdown) growthMap.set(x.name, { prev: x.count, curr: 0 });
    for (const x of last7Agg.productsBreakdown) {
      const cur = growthMap.get(x.name) || { prev: 0, curr: 0 };
      cur.curr = x.count;
      growthMap.set(x.name, cur);
    }
    const growthRows = [...growthMap.entries()].map(([name, v]) => ({ name, delta: v.curr - v.prev, prev: v.prev, curr: v.curr }));
    const fastestGrowingProduct = growthRows.length
      ? growthRows.sort((a, b) => b.delta - a.delta || a.name.localeCompare(b.name, "de"))[0]
      : null;
    const slowestMovingProduct = growthRows.length
      ? growthRows.sort((a, b) => a.delta - b.delta || a.name.localeCompare(b.name, "de"))[0]
      : null;

    const bestWorstDay = (arr) => {
      if (!arr.length) return { best: null, worst: null };
      const sorted = [...arr].sort((a, b) => a.count - b.count || a.date.localeCompare(b.date));
      return { worst: sorted[0], best: sorted[sorted.length - 1] };
    };
    const day7 = bestWorstDay(last7Agg.ordersByDay);
    const day30 = bestWorstDay(last30Agg.ordersByDay);

    const generatedAt = new Date().toISOString();
    const averageOrderValue = selectedAgg.ordersCount > 0 ? Math.round((selectedAgg.revenue / selectedAgg.ordersCount) * 100) / 100 : 0;
    const averageUnitsPerOrder = selectedAgg.ordersCount > 0 ? Math.round((selectedAgg.itemsSold / selectedAgg.ordersCount) * 100) / 100 : 0;
    const unavailableMetrics = [
      "ordersFromRegistration",
      "savedReceptionMinutes",
      "positiveFeedbackCount",
      "negativeFeedbackCount",
      "topPositiveKeywords",
      "topNegativeKeywords",
      "unpaidCheckouts",
      "departuresTomorrowUnpaid"
    ];
    const supportedMetrics = [
      "ordersToday",
      "ordersYesterday",
      "ordersLast7Days",
      "ordersLast30Days",
      "ordersBetween18And21",
      "ordersByHour",
      "ordersByDay",
      "productsBreakdown",
      "revenueToday",
      "revenueYesterday",
      "revenueLast7Days",
      "revenueLast30Days",
      "comparisons",
      "registration.onlineRegistrationForms*"
    ];

    return NextResponse.json({
      ok: true,
      branch: branch.slug,
      range,
      generatedAt,
      supportedMetrics,
      unavailableMetrics,
      data: {
        ordersToday: todayAgg.ordersCount,
        ordersYesterday: yesterdayAgg.ordersCount,
        ordersLast7Days: last7Agg.ordersCount,
        ordersLast30Days: last30Agg.ordersCount,
        ordersFromRegistration: null,
        ordersBetween18And21: selectedAgg.orders18to21,
        ordersByProduct: selectedAgg.productsBreakdown.map((x) => ({ name: x.name, count: x.count })),
        savedReceptionMinutes: null,
        positiveFeedbackCount: null,
        negativeFeedbackCount: null,
        topPositiveKeywords: null,
        topNegativeKeywords: null,
        unpaidCheckouts: null,
        departuresTomorrowUnpaid: null,
        summary: {
          totalOrdersAllTime: allTimeAgg.ordersCount,
          totalRevenueAllTime: allTimeAgg.revenue,
          ordersToday: todayAgg.ordersCount,
          ordersBetween18And21: allTimeAgg.orders18to21,
          revenueToday: todayAgg.revenue,
          orders: selectedAgg.ordersCount,
          itemsSold: selectedAgg.itemsSold,
          revenue: selectedAgg.revenue,
          averageOrderValue,
          averageItemsPerOrder: averageUnitsPerOrder,
          averageUnitsPerOrder
        },
        timeAnalytics: {
          ordersByHour: selectedAgg.ordersByHour,
          ordersByDay: selectedAgg.ordersByDay,
          peakHour: selectedAgg.peakHour,
          peakDay: selectedAgg.peakDay,
          busiestHour: selectedAgg.peakHour,
          busiestDay: selectedAgg.peakDay
        },
        products: {
          topSellingProductAllTime,
          topProductsAllTime,
          ordersByPastryType: pastryAllTime.map((x) => ({ name: x.name, quantitySold: x.quantitySold })),
          topProducts: selectedAgg.topProducts,
          productsBreakdown: selectedAgg.productsBreakdown,
          topProductsLast7Days: last7Agg.topProducts,
          topProductsLast30Days: last30Agg.topProducts,
          totalItemsSoldToday: todayAgg.itemsSold,
          totalItemsSoldYesterday: yesterdayAgg.itemsSold,
          totalItemsSoldLast7Days: last7Agg.itemsSold,
          totalItemsSoldLast30Days: last30Agg.itemsSold,
          productShareOfSales: selectedAgg.productsBreakdown.map((x) => ({ name: x.name, sharePct: x.shareOfSalesPct })),
          productShareOfOrders: selectedAgg.productsBreakdown.map((x) => ({ name: x.name, sharePct: x.shareOfOrdersPct }))
        },
        revenue: {
          revenueToday: todayAgg.revenue,
          revenueYesterday: yesterdayAgg.revenue,
          revenueLast7Days: last7Agg.revenue,
          revenueLast30Days: last30Agg.revenue,
          averageOrderValue,
          revenueByProduct: selectedAgg.revenueByProduct,
          topRevenueProducts: selectedAgg.topRevenueProducts,
          revenuePerDay: selectedAgg.revenuePerDay,
          revenuePerHour: selectedAgg.revenuePerHour,
          peakRevenueDay: selectedAgg.peakRevenueDay,
          peakRevenueHour: selectedAgg.peakRevenueHour
        },
        comparisons: {
          ordersTodayVsYesterdayPct: pctChange(todayAgg.ordersCount, yesterdayAgg.ordersCount),
          ordersLast7VsPrev7Pct: pctChange(last7Agg.ordersCount, prev7Agg.ordersCount),
          ordersLast30VsPrev30Pct: pctChange(last30Agg.ordersCount, prev30Agg.ordersCount),
          revenueTodayVsYesterdayPct: pctChange(todayAgg.revenue, yesterdayAgg.revenue),
          revenueLast7VsPrev7Pct: pctChange(last7Agg.revenue, prev7Agg.revenue),
          revenueLast30VsPrev30Pct: pctChange(last30Agg.revenue, prev30Agg.revenue),
          itemsSoldTodayVsYesterdayPct: pctChange(todayAgg.itemsSold, yesterdayAgg.itemsSold),
          itemsSoldLast7VsPrev7Pct: pctChange(last7Agg.itemsSold, prev7Agg.itemsSold),
          itemsSoldLast30VsPrev30Pct: pctChange(last30Agg.itemsSold, prev30Agg.itemsSold)
        },
        registration: {
          onlineRegistrationFormsToday: regToday.forms,
          onlineRegistrationFormsYesterday: regYesterday.forms,
          onlineRegistrationFormsLast7Days: regLast7.forms,
          onlineRegistrationFormsLast30Days: regLast30.forms,
          breakfastOrdersFromRegistration: regSelected.breakfastTrue,
          breakfastOrdersFromRegistrationLast7Days: regLast7.breakfastTrue,
          registrationToBreakfastConversion:
            regSelected.forms > 0 ? Math.round((regSelected.breakfastTrue / regSelected.forms) * 1000) / 10 : 0,
          registrationShareOfBreakfastOrders:
            selectedAgg.ordersCount > 0 ? Math.round((regSelected.breakfastTrue / selectedAgg.ordersCount) * 1000) / 10 : 0
        },
        decisionSupport: {
          strongestProduct,
          weakestProduct,
          fastestGrowingProduct,
          slowestMovingProduct,
          bestSellingDayLast7Days: day7.best,
          worstSellingDayLast7Days: day7.worst,
          bestSellingDayLast30Days: day30.best,
          worstSellingDayLast30Days: day30.worst
        }
      }
    });
  } catch {
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
