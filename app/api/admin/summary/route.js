import { NextResponse } from "next/server";
import { requireAdminCookie } from "@/lib/admin-api-guard";
import { getSupabaseServerClient } from "@/lib/supabase";
import { berlinDateFromIso, berlinDateWithOffset, berlinHourFromIso, getBerlinNow } from "@/lib/order-utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

/** 0 = Montag … 6 = Sonntag (Europe/Berlin, Kalendertag ymd). */
function berlinWeekdayMon0(ymd) {
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  const u = Date.UTC(y, m - 1, d, 12, 0, 0);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Berlin", weekday: "short" }).formatToParts(new Date(u));
  const s = parts.find((p) => p.type === "weekday")?.value;
  const map = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return map[s] ?? 0;
}

function mondayOfCalendarWeekBerlin(todayYmd) {
  const wd = berlinWeekdayMon0(todayYmd);
  return addBerlinDays(todayYmd, -wd);
}

export async function GET() {
  const unauthorized = requireAdminCookie();
  if (unauthorized) return unauthorized;
  const supabase = getSupabaseServerClient();
  const { date: today } = getBerlinNow();
  const weekMonday = mondayOfCalendarWeekBerlin(today);
  const weekSunday = addBerlinDays(weekMonday, 6);
  const prevWeekMonday = addBerlinDays(weekMonday, -7);
  const prevWeekSunday = addBerlinDays(weekMonday, -1);

  const [{ data: allOrders, error: ordersErr }, { data: allItems, error: itemsErr }] = await Promise.all([
    supabase.from("orders").select("id,created_at,total_amount,status,delivered_at,pickup_date").order("created_at", { ascending: true }),
    supabase.from("order_items").select("order_id,quantity,unit_price,product_id,menu_id,products(name),menus(name)")
  ]);

  if (ordersErr) return NextResponse.json({ error: ordersErr.message }, { status: 500 });
  if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 });

  const orders = allOrders || [];
  const items = allItems || [];

  const ordersToday = orders.filter((o) => berlinDateFromIso(o.created_at) === today);
  const ordersTodayIds = new Set(ordersToday.map((o) => o.id));
  const revenueToday = ordersToday.reduce((a, o) => a + Number(o.total_amount || 0), 0);
  let itemsToday = 0;
  for (const i of items) {
    if (ordersTodayIds.has(i.order_id)) itemsToday += Number(i.quantity || 0);
  }

  const pendingToday = orders.filter((o) => o.status === "pending" && o.pickup_date === today).length;
  const deliveredToday = orders.filter((o) => {
    if (o.status !== "delivered") return false;
    const d = o.delivered_at ? berlinDateFromIso(o.delivered_at) : null;
    return d === today;
  }).length;

  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((a, o) => a + Number(o.total_amount || 0), 0);
  const totalArticlesSold = items.reduce((a, i) => a + Number(i.quantity || 0), 0);

  const inThisCalendarWeek = (o) => {
    const cd = berlinDateFromIso(o.created_at);
    return cd >= weekMonday && cd <= weekSunday;
  };
  const inPrevCalendarWeek = (o) => {
    const cd = berlinDateFromIso(o.created_at);
    return cd >= prevWeekMonday && cd <= prevWeekSunday;
  };

  const weekOrders = orders.filter(inThisCalendarWeek);
  const prevWeekOrders = orders.filter(inPrevCalendarWeek);
  const ordersThisWeek = weekOrders.length;
  const revenueThisWeek = weekOrders.reduce((a, o) => a + Number(o.total_amount || 0), 0);
  const ordersLastWeek = prevWeekOrders.length;
  const revenueLastWeek = prevWeekOrders.reduce((a, o) => a + Number(o.total_amount || 0), 0);

  const productTotals = new Map();
  const menuTotals = new Map();
  const hourCounts = new Array(24).fill(0);
  let orders18to21 = 0;

  for (const o of orders) {
    const h = berlinHourFromIso(o.created_at);
    if (h != null) {
      hourCounts[h] += 1;
      if (h >= 18 && h <= 21) orders18to21 += 1;
    }
  }

  let peakHour = 0;
  let peakCount = -1;
  for (let h = 0; h < 24; h++) {
    if (hourCounts[h] > peakCount) {
      peakCount = hourCounts[h];
      peakHour = h;
    }
  }
  const peakHourLabel =
    peakCount <= 0 ? null : `${String(peakHour).padStart(2, "0")}:00 – ${String((peakHour + 1) % 24).padStart(2, "0")}:00 Uhr`;

  for (const i of items) {
    const pn = i.products?.name;
    const mn = i.menus?.name;
    const q = Number(i.quantity || 0);
    if (pn) productTotals.set(pn, (productTotals.get(pn) || 0) + q);
    if (mn) menuTotals.set(mn, (menuTotals.get(mn) || 0) + q);
  }

  const sortDesc = (map) =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, qty]) => ({ name, qty }));

  const topProducts = sortDesc(productTotals).slice(0, 5);
  const topMenus = sortDesc(menuTotals).slice(0, 5);
  const topProduct = topProducts[0]?.name || null;
  const topMenu = topMenus[0]?.name || null;

  const tomorrowPickup = berlinDateWithOffset(1);
  const pendingTomorrowRes = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("pickup_date", tomorrowPickup)
    .eq("status", "pending");

  return NextResponse.json({
    ordersToday: ordersToday.length,
    revenueToday,
    itemsToday,
    pendingToday,
    deliveredToday,
    totalOrders,
    totalRevenue,
    totalArticlesSold,
    ordersThisWeek,
    revenueThisWeek,
    ordersLastWeek,
    revenueLastWeek,
    weekOverWeekOrdersPct:
      ordersLastWeek > 0 ? Math.round(((ordersThisWeek - ordersLastWeek) / ordersLastWeek) * 1000) / 10 : ordersThisWeek > 0 ? 100 : 0,
    weekOverWeekRevenuePct:
      revenueLastWeek > 0
        ? Math.round(((revenueThisWeek - revenueLastWeek) / revenueLastWeek) * 1000) / 10
        : revenueThisWeek > 0
          ? 100
          : 0,
    topProduct,
    topMenu,
    topProducts,
    topMenus,
    orders18to21,
    peakHour,
    peakHourLabel,
    peakOrderCount: peakCount,
    hourlyDistribution: hourCounts.map((c, h) => ({ hour: h, count: c })),
    pendingTomorrow: pendingTomorrowRes.count || 0,
    weekRangeLabel: `${weekMonday} · ${weekSunday}`
  });
}
