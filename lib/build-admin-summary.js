import { berlinDateFromIso, berlinHourFromIso } from "@/lib/order-utils";

export function addBerlinDays(ymd, n) {
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

function berlinWeekdayMon0(ymd) {
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  const u = Date.UTC(y, m - 1, d, 12, 0, 0);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Berlin", weekday: "short" }).formatToParts(
    new Date(u)
  );
  const s = parts.find((p) => p.type === "weekday")?.value;
  const map = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return map[s] ?? 0;
}

export function mondayOfCalendarWeekBerlin(todayYmd) {
  const wd = berlinWeekdayMon0(todayYmd);
  return addBerlinDays(todayYmd, -wd);
}

function shortDayLabel(ymd) {
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  const u = Date.UTC(y, m - 1, d, 12, 0, 0);
  return new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "short", day: "numeric" }).format(
    new Date(u)
  );
}

/**
 * @param {{ orders: object[], items: object[], today: string, pendingTomorrow: number, registrations?: { registrationsToday: number, registrationsTotal: number, registrationDailyCounts: {date:string,count:number}[] } | null }} input
 */
export function buildAdminSummaryPayload({ orders, items, today, pendingTomorrow, registrations = null }) {
  const weekMonday = mondayOfCalendarWeekBerlin(today);
  const weekSunday = addBerlinDays(weekMonday, 6);
  const prevWeekMonday = addBerlinDays(weekMonday, -7);
  const prevWeekSunday = addBerlinDays(weekMonday, -1);

  const deliveredOrders = orders.filter((o) => o.status === "delivered");
  const notPickedUpOrders = orders.filter((o) => o.status === "not_picked_up");

  const ordersToday = orders.filter((o) => berlinDateFromIso(o.created_at) === today);
  const deliveredTodayOrders = deliveredOrders.filter((o) => {
    const d = o.delivered_at ? berlinDateFromIso(o.delivered_at) : null;
    return d === today;
  });
  const notPickedUpTodayOrders = notPickedUpOrders.filter((o) => berlinDateFromIso(o.created_at) === today);
  const ordersTodayIds = new Set(ordersToday.map((o) => o.id));
  const revenueToday = deliveredTodayOrders.reduce((a, o) => a + Number(o.total_amount || 0), 0);
  let itemsToday = 0;
  for (const i of items) {
    if (ordersTodayIds.has(i.order_id)) itemsToday += Number(i.quantity || 0);
  }

  const pendingToday = orders.filter((o) => o.status === "pending" && o.pickup_date === today).length;
  const deliveredToday = deliveredTodayOrders.length;
  const notPickedUpToday = notPickedUpTodayOrders.length;

  const pickupTodayTotal = pendingToday + deliveredToday + notPickedUpToday;
  const pickupFulfilledPct =
    pickupTodayTotal > 0 ? Math.round((deliveredToday / pickupTodayTotal) * 1000) / 10 : null;
  const avgOrderValueToday =
    deliveredToday > 0 ? Math.round((revenueToday / deliveredToday) * 100) / 100 : 0;

  const totalOrders = orders.length;
  const totalRevenue = deliveredOrders.reduce((a, o) => a + Number(o.total_amount || 0), 0);
  const notPickedUpTotal = notPickedUpOrders.length;
  const notPickedUpDetails = [...notPickedUpOrders]
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
    .map((o) => ({
      id: o.id,
      orderNumber: o.order_number ?? null,
      customerName: o.customer_name || "",
      createdAt: o.created_at || null,
      pickupDate: o.pickup_date || null,
      reason: o.not_picked_up_reason || null,
      note: o.not_picked_up_note || ""
    }));
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
  const deliveredWeekOrders = deliveredOrders.filter(inThisCalendarWeek);
  const deliveredPrevWeekOrders = deliveredOrders.filter(inPrevCalendarWeek);
  const ordersThisWeek = weekOrders.length;
  const revenueThisWeek = deliveredWeekOrders.reduce((a, o) => a + Number(o.total_amount || 0), 0);
  const ordersLastWeek = prevWeekOrders.length;
  const revenueLastWeek = deliveredPrevWeekOrders.reduce((a, o) => a + Number(o.total_amount || 0), 0);

  const productTotals = new Map();
  const menuTotals = new Map();
  const hourCounts = new Array(24).fill(0);
  let orders18to21 = 0;
  let ordersBusinessHours = 0;

  for (const o of orders) {
    const h = berlinHourFromIso(o.created_at);
    if (h != null) {
      hourCounts[h] += 1;
      if (h >= 18 && h <= 21) orders18to21 += 1;
      if (h >= 8 && h <= 21) ordersBusinessHours += 1;
    }
  }

  let peakHour = 0;
  let peakCount = -1;
  for (let h = 8; h <= 21; h++) {
    if (hourCounts[h] > peakCount) {
      peakCount = hourCounts[h];
      peakHour = h;
    }
  }
  if (peakCount < 0) {
    for (let h = 0; h < 24; h++) {
      if (hourCounts[h] > peakCount) {
        peakCount = hourCounts[h];
        peakHour = h;
      }
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

  const ordersTrend14Days = [];
  for (let offset = 13; offset >= 0; offset--) {
    const d = addBerlinDays(today, -offset);
    const dayOrders = orders.filter((o) => berlinDateFromIso(o.created_at) === d);
    const dayRevenue = deliveredOrders
      .filter((o) => o.delivered_at && berlinDateFromIso(o.delivered_at) === d)
      .reduce((a, o) => a + Number(o.total_amount || 0), 0);
    ordersTrend14Days.push({
      date: d,
      label: shortDayLabel(d),
      orders: dayOrders.length,
      revenue: Math.round(dayRevenue * 100) / 100
    });
  }

  const hourlyOrderingWindow = [];
  for (let h = 8; h <= 21; h++) {
    hourlyOrderingWindow.push({ hour: h, count: hourCounts[h] });
  }

  const alerts = [];
  if (pendingTomorrow >= 15) {
    alerts.push({
      level: "info",
      title: "Hohe Vorbestellung morgen",
      body: `${pendingTomorrow} offene Bestellungen mit Abholung morgen — Küche und Personal einplanen.`
    });
  } else if (pendingTomorrow >= 8) {
    alerts.push({
      level: "info",
      title: "Vorbestellungen morgen",
      body: `${pendingTomorrow} Bestellungen stehen für morgen an.`
    });
  }
  if (pendingToday >= 5) {
    alerts.push({
      level: "warn",
      title: "Offene Abholungen heute",
      body: `${pendingToday} Bestellungen warten noch auf Ausgabe heute.`
    });
  }
  if (notPickedUpToday > 0) {
    alerts.push({
      level: "warn",
      title: "Nicht abgeholt heute",
      body: `${notPickedUpToday} Bestellung(en) als nicht abgeholt markiert — Gründe prüfen.`
    });
  }
  if (ordersToday.length > 0 && deliveredToday === 0 && pendingToday > 0) {
    alerts.push({
      level: "info",
      title: "Eingang ohne Auslieferung",
      body: `${ordersToday.length} neue Bestellung(en) heute, noch keine Auslieferung erfasst.`
    });
  }

  const payload = {
    ordersToday: ordersToday.length,
    revenueToday,
    itemsToday,
    pendingToday,
    deliveredToday,
    notPickedUpToday,
    avgOrderValueToday,
    pickupFulfilledPct,
    pickupTodayTotal,
    totalOrders,
    totalRevenue,
    notPickedUpTotal,
    notPickedUpDetails,
    totalArticlesSold,
    ordersThisWeek,
    revenueThisWeek,
    ordersLastWeek,
    revenueLastWeek,
    weekOverWeekOrdersPct:
      ordersLastWeek > 0
        ? Math.round(((ordersThisWeek - ordersLastWeek) / ordersLastWeek) * 1000) / 10
        : ordersThisWeek > 0
          ? 100
          : 0,
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
    ordersBusinessHours,
    ordersBusinessHoursPct:
      totalOrders > 0 ? Math.round((ordersBusinessHours / totalOrders) * 1000) / 10 : 0,
    peakHour,
    peakHourLabel,
    peakOrderCount: Math.max(0, peakCount),
    hourlyDistribution: hourCounts.map((c, h) => ({ hour: h, count: c })),
    hourlyOrderingWindow,
    ordersTrend14Days,
    alerts,
    pendingTomorrow,
    weekRangeLabel: `${weekMonday} · ${weekSunday}`
  };

  if (registrations) {
    payload.registrationsToday = registrations.registrationsToday;
    payload.registrationsTotal = registrations.registrationsTotal;
    payload.registrationDailyCounts = registrations.registrationDailyCounts;
  }

  return payload;
}
