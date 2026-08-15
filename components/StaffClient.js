"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parseEigenesMenueFromCustomerName } from "@/lib/eigenes-menue";
import { menuCompositionLinesFromDescription } from "@/lib/staff-menu-display";
import { formatMoney } from "@/lib/format-money";
import {
  DEFAULT_NOT_PICKED_UP_REASON,
  NOT_PICKED_UP_REASON_OPTIONS
} from "@/lib/not-picked-up-reasons";
import RegistrationsStaffSection from "@/components/RegistrationsStaffSection";
import StaffRepeatOrderModal from "@/components/StaffRepeatOrderModal";
import StaffOrderOverridePanel from "@/components/StaffOrderOverridePanel";
import { printPacklisteDocument } from "@/lib/packliste-print";
import { getBerlinNow, tomorrowBerlinDate } from "@/lib/order-utils";

function statusLabel(s) {
  if (s === "pending") return "Ausstehend";
  if (s === "delivered") return "Ausgeliefert";
  if (s === "not_picked_up") return "Nicht abgeholt";
  return s || "—";
}

function statusBadgeClass(s) {
  if (s === "delivered") return "border-brand-green/35 bg-brand-green/10 text-brand-green";
  if (s === "not_picked_up") return "border-slate-300 bg-slate-100 text-slate-800";
  return "border-brand-yellow/50 bg-brand-yellow/15 text-brand-green";
}

function orderPickupYmd(pickupDate) {
  if (!pickupDate) return "";
  return String(pickupDate).slice(0, 10);
}

/** Prepaid always; unpaid only while pickup is still tomorrow or today. */
function orderPaymentLabel(order, tomorrowYmd, todayYmd) {
  if (order?.paid_at) return "paid";
  const pickup = orderPickupYmd(order?.pickup_date);
  if (pickup === tomorrowYmd || pickup === todayYmd) return "open";
  return null;
}

function paymentBadgeClass(paid) {
  return paid
    ? "border-brand-green/35 bg-brand-green/10 text-brand-green"
    : "border-amber-300/80 bg-amber-50 text-amber-900";
}

/** Fixed rows for the print-only Packliste summary (matches matrix product names). */
const PACKLISTE_PRINT_SUMMARY_PRODUCTS = [
  "Knusperbrötchen",
  "Farmerbrötchen",
  "Laugenbrezel",
  "Buttercroissant"
];

export default function StaffClient({ apiPrefix = "/api/staff", showRegistration = false }) {
  const packlistePrintInFlightRef = useRef(false);
  const [activeTab, setActiveTab] = useState("orders");
  const [service, setService] = useState("today");
  const [orderListMode, setOrderListMode] = useState("open");
  const [orderCounts, setOrderCounts] = useState({ open: 0, done: 0 });
  const [pickupDateYmd, setPickupDateYmd] = useState("");
  const [clearingDone, setClearingDone] = useState(false);
  const [q, setQ] = useState("");
  const [orders, setOrders] = useState([]);
  const [catalog, setCatalog] = useState({ products: [], menus: [] });
  const [preparationSummary, setPreparationSummary] = useState({ products: [], menus: [] });
  const [preparationPacklist, setPreparationPacklist] = useState([]);
  const [dayMatrixPacklist, setDayMatrixPacklist] = useState([]);
  const [packOpen, setPackOpen] = useState(false);
  const [pickupDateLabel, setPickupDateLabel] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState(null);
  const [drinksOpen, setDrinksOpen] = useState(false);
  const [confirmNotPickedUpId, setConfirmNotPickedUpId] = useState(null);
  const [notPickedUpReason, setNotPickedUpReason] = useState(DEFAULT_NOT_PICKED_UP_REASON);
  const [notPickedUpNote, setNotPickedUpNote] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualCustomerName, setManualCustomerName] = useState("");
  const [manualService, setManualService] = useState("today");
  const [manualPaidNow, setManualPaidNow] = useState(false);
  const [manualProductQty, setManualProductQty] = useState({});
  const [manualCatalogLoading, setManualCatalogLoading] = useState(false);
  const [manualSuccess, setManualSuccess] = useState(null);
  const [repeatOrder, setRepeatOrder] = useState(null);
  const [repeatSuccess, setRepeatSuccess] = useState(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideUnlocked, setOverrideUnlocked] = useState(false);
  const orderNumberTaps = useRef(0);
  const orderNumberTapTimer = useRef(null);

  async function load() {
    setLoading(true);
    setErr("");
    const res = await fetch(
      `${apiPrefix}/orders?service=${service}&list=${orderListMode}&q=${encodeURIComponent(q)}`,
      { cache: "no-store" }
    );
    const data = await res.json();
    if (!res.ok) setErr(data.error || "Fehler beim Laden.");
    setOrders(data.orders || []);
    setOrderCounts(data.counts || { open: 0, done: 0 });
    setPickupDateYmd(data.pickupDate || "");
    if (data.preparationSummary) setPreparationSummary(data.preparationSummary);
    if (Array.isArray(data.preparationPacklist)) setPreparationPacklist(data.preparationPacklist);
    if (Array.isArray(data.dayMatrixPacklist)) setDayMatrixPacklist(data.dayMatrixPacklist);
    if (data.pickupDate) setPickupDateLabel(data.pickupDate);
    if (data.catalog) setCatalog(data.catalog);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, orderListMode, q, apiPrefix]);

  useEffect(() => {
    if (activeTab !== "orders") return;
    function updateScrollHints() {
      const y = window.scrollY;
      const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      setCanScrollUp(y > 80);
      setCanScrollDown(y < max - 80);
    }
    updateScrollHints();
    window.addEventListener("scroll", updateScrollHints, { passive: true });
    window.addEventListener("resize", updateScrollHints);
    return () => {
      window.removeEventListener("scroll", updateScrollHints);
      window.removeEventListener("resize", updateScrollHints);
    };
  }, [activeTab, orders.length, loading, orderListMode]);

  async function clearDoneFromStaffList() {
    if (
      !window.confirm(
        "Alle erledigten Bestellungen aus der Team-Liste entfernen?\n\nDie Daten bleiben in der Datenbank (Admin/Export)."
      )
    ) {
      return;
    }
    setClearingDone(true);
    setErr("");
    try {
      const res = await fetch(`${apiPrefix}/orders/clear-done`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pickupDate: pickupDateYmd, service })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Liste konnte nicht geleert werden.");
      await load();
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setClearingDone(false);
    }
  }

  async function deliver(id) {
    const res = await fetch(`${apiPrefix}/orders/${id}/deliver`, { method: "PATCH" });
    if (!res.ok) {
      const data = await res.json();
      setErr(data.error || "Status konnte nicht gesetzt werden.");
      return;
    }
    setDetailId(null);
    await load();
  }

  async function markNotPickedUp(id) {
    const res = await fetch(`${apiPrefix}/orders/${id}/not-picked-up`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: notPickedUpReason || DEFAULT_NOT_PICKED_UP_REASON,
        note: notPickedUpNote
      })
    });
    if (!res.ok) {
      const data = await res.json();
      setErr(data.error || "Status konnte nicht gesetzt werden.");
      return;
    }
    setDetailId(null);
    setConfirmNotPickedUpId(null);
    setNotPickedUpReason(DEFAULT_NOT_PICKED_UP_REASON);
    setNotPickedUpNote("");
    await load();
  }

  useEffect(() => {
    if (!confirmNotPickedUpId) return;
    function onKeyDown(e) {
      if (e.key === "Escape") {
        setConfirmNotPickedUpId(null);
        setNotPickedUpReason(DEFAULT_NOT_PICKED_UP_REASON);
        setNotPickedUpNote("");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmNotPickedUpId]);

  const berlinTomorrowYmd = tomorrowBerlinDate();
  const { date: berlinTodayYmd } = getBerlinNow();
  const detailOrder = detailId ? orders.find((o) => o.id === detailId) : null;
  const detailPaymentLabel = detailOrder ? orderPaymentLabel(detailOrder, berlinTomorrowYmd, berlinTodayYmd) : null;
  /** Deliver / not-picked-up only on the real pickup day (today), never for tomorrow orders. */
  const canCompletePickupToday =
    Boolean(detailOrder) &&
    orderListMode === "open" &&
    detailOrder.status === "pending" &&
    orderPickupYmd(detailOrder.pickup_date) === berlinTodayYmd;

  function tapOrderNumberForOverride() {
    orderNumberTaps.current += 1;
    if (orderNumberTapTimer.current) clearTimeout(orderNumberTapTimer.current);
    orderNumberTapTimer.current = setTimeout(() => {
      orderNumberTaps.current = 0;
    }, 1200);
    if (orderNumberTaps.current >= 5) {
      orderNumberTaps.current = 0;
      setOverrideOpen(true);
    }
  }

  function closeDetail() {
    setDetailId(null);
    setOverrideOpen(false);
  }

  const detailNameParts = useMemo(
    () => (detailOrder ? parseEigenesMenueFromCustomerName(detailOrder.customer_name) : { cleanName: "", groups: [] }),
    [detailOrder]
  );
  const prepProductsPrimary = useMemo(
    () => (preparationSummary.products || []).filter((x) => x.category !== "getraenke"),
    [preparationSummary.products]
  );
  const prepProductsDrinks = useMemo(
    () => (preparationSummary.products || []).filter((x) => x.category === "getraenke"),
    [preparationSummary.products]
  );
  /** Full-day packlist for matrix: pending + delivered + not_picked_up (non-drinks columns). */
  const manualTotal = useMemo(() => {
    let sum = 0;
    for (const p of catalog.products || []) {
      const qty = Number(manualProductQty[String(p.id)] || 0);
      if (qty > 0) sum += qty * Number(p.price || 0);
    }
    return Math.round(sum * 100) / 100;
  }, [catalog, manualProductQty]);
  const matrixProductsPrimary = useMemo(
    () => (dayMatrixPacklist || []).filter((x) => x.category !== "getraenke"),
    [dayMatrixPacklist]
  );
  const matrixOrderNumbers = useMemo(() => {
    const s = new Set();
    for (const p of matrixProductsPrimary) for (const x of p.per_order || []) s.add(Number(x.order_number));
    return [...s].sort((a, b) => a - b);
  }, [matrixProductsPrimary]);
  /** Print-only summary: day totals for fixed products (same qty source as matrix). */
  const packlistePrintSummaryCounts = useMemo(() => {
    const byName = new Map(matrixProductsPrimary.map((p) => [String(p.name), Number(p.qty || 0)]));
    return PACKLISTE_PRINT_SUMMARY_PRODUCTS.map((name) => ({
      name,
      qty: byName.get(name) ?? 0
    }));
  }, [matrixProductsPrimary]);

  const prepPiecesTotal = useMemo(
    () => prepProductsPrimary.reduce((a, r) => a + Number(r.qty || 0), 0),
    [prepProductsPrimary]
  );

  async function loadManualCatalog() {
    setManualCatalogLoading(true);
    try {
      const res = await fetch(`${apiPrefix}/catalog`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.catalog) {
        setCatalog(data.catalog);
      } else if (!res.ok) {
        setErr(data.error || "Katalog konnte nicht geladen werden.");
      }
    } catch {
      setErr("Katalog konnte nicht geladen werden.");
    } finally {
      setManualCatalogLoading(false);
    }
  }

  async function openManualOrder() {
    setErr("");
    setManualService("today");
    setManualPaidNow(false);
    setManualCustomerName("");
    setManualProductQty({});
    setManualOpen(true);
    if (!(catalog.products || []).length) {
      await loadManualCatalog();
    }
  }

  async function submitManualOrder() {
    setErr("");
    if (manualService === "tomorrow" && !manualCustomerName.trim()) {
      setErr("Für morgen ist ein Name erforderlich.");
      return;
    }
    setManualSubmitting(true);
    const { date: todayBerlin } = getBerlinNow();
    const pickupDate = manualService === "tomorrow" ? berlinTomorrowYmd : todayBerlin;
    const payload = {
      customerName: manualCustomerName.trim(),
      pickupDate,
      productQuantities: manualProductQty,
      ...(manualService === "tomorrow" ? { paidNow: manualPaidNow } : {})
    };
    const res = await fetch(`${apiPrefix}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    setManualSubmitting(false);
    if (!res.ok) {
      setErr(data.error || "Vor-Ort-Verkauf konnte nicht gespeichert werden.");
      return;
    }
    setManualOpen(false);
    setManualSuccess({
      orderNumber: data.orderNumber ?? null,
      customerName: manualCustomerName.trim() || "Vor-Ort-Verkauf",
      pickupDay: manualService,
      paidNow: manualService === "tomorrow" && manualPaidNow
    });
    if (manualService === "tomorrow") setService("tomorrow");
    await load();
  }

  function printPackliste() {
    if (typeof window === "undefined") return;
    if (packlistePrintInFlightRef.current) return;
    packlistePrintInFlightRef.current = true;
    const cleanup = printPacklisteDocument("#packliste-print-area");
    const finish = () => {
      packlistePrintInFlightRef.current = false;
      cleanup?.();
    };
    window.addEventListener("afterprint", finish, { once: true });
    window.setTimeout(finish, 2500);
  }

  return (
    <div className="space-y-5 pb-6 sm:space-y-6 sm:pb-8">
      <section className="fb-hero !p-4 sm:!p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/75 sm:text-xs">Team</p>
            <h1 className="mt-0.5 text-lg font-bold leading-tight sm:text-xl">Staff-Dashboard</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {showRegistration ? (
              activeTab === "registrations" ? (
                <button
                  type="button"
                  onClick={() => setActiveTab("orders")}
                  className="min-h-10 rounded-2xl bg-white/20 px-3.5 py-2 text-sm font-bold text-white ring-1 ring-white/30 hover:bg-white/30"
                >
                  Bestellungen
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveTab("registrations")}
                  className="min-h-10 rounded-2xl bg-white/20 px-3.5 py-2 text-sm font-bold text-white ring-1 ring-white/30 hover:bg-white/30"
                >
                  Registrierungen
                </button>
              )
            ) : null}
            {activeTab === "orders" ? (
              <button
                type="button"
                onClick={openManualOrder}
                className="min-h-10 rounded-2xl bg-white px-3.5 py-2 text-sm font-bold text-brand-green shadow-md hover:bg-white/95"
              >
                + Vor-Ort-Verkauf
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {showRegistration && activeTab === "registrations" ? (
        <RegistrationsStaffSection apiPrefix={apiPrefix} />
      ) : null}
      {activeTab === "orders" || !showRegistration ? (
        <>
          <div className="staff-dashboard-split space-y-5 xl:grid xl:grid-cols-[minmax(280px,22rem)_1fr] xl:items-start xl:gap-6 xl:space-y-0">
            <div className="staff-dashboard-side space-y-5 xl:sticky xl:top-4 xl:space-y-5">
          <section className="rounded-3xl bg-gradient-to-br from-brand-teal to-brand-green p-4 text-white shadow-md sm:p-5">
            <p className="text-sm font-semibold">Bestellansicht</p>
            <p className="mt-1 text-xs text-white/90">Schnell erfassen, ausliefern und im Blick behalten.</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3">
              <button
                type="button"
                className={`min-h-12 rounded-2xl px-3 py-2.5 text-sm font-bold transition active:scale-[0.99] sm:min-h-0 ${service === "today" ? "bg-white text-brand-green shadow-md" : "bg-white/15 text-white hover:bg-white/25"}`}
                onClick={() => setService("today")}
              >
                Heute
              </button>
              <button
                type="button"
                className={`min-h-12 rounded-2xl px-3 py-2.5 text-sm font-bold transition active:scale-[0.99] sm:min-h-0 ${service === "tomorrow" ? "bg-white text-brand-green shadow-md" : "bg-white/15 text-white hover:bg-white/25"}`}
                onClick={() => setService("tomorrow")}
              >
                Morgen
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-brand-yellow/40 bg-white p-4 shadow-md ring-1 ring-slate-200/90 sm:p-5 xl:max-h-[calc(100dvh-5rem)] xl:overflow-y-auto xl:overscroll-y-contain">
            <h2 className="text-base font-bold leading-snug text-slate-900">
              {service === "tomorrow" ? "Was morgen vorbereitet werden muss" : "Was heute vorbereitet werden muss"}
            </h2>
            {pickupDateLabel ? (
              <p className="mt-1 text-xs font-medium text-slate-500">Abholdatum (alle offenen Bestellungen): {pickupDateLabel}</p>
            ) : null}
            {loading ? <p className="mt-3 text-sm text-slate-500">Vorbereitungsliste wird geladen…</p> : null}
            {!loading &&
            preparationSummary.products.length === 0 &&
            preparationSummary.menus.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">Keine offenen Bestellungen für diesen Tag – nichts zu aggregieren.</p>
            ) : null}
            {prepProductsPrimary.length > 0 ? (
              <div className="mt-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Backwaren & Extras (Stück)</p>
                <ul className="mt-2 space-y-2 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0 xl:grid-cols-1 xl:space-y-2">
                  {prepProductsPrimary.map((row) => (
                    <li key={row.name} className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 break-words font-medium text-slate-800">{row.name}</span>
                        <span className="tabular-nums text-base font-black text-brand-green">{row.qty}×</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
              <button
                type="button"
                onClick={() => setDrinksOpen((v) => !v)}
                className="min-h-10 w-full text-left text-xs font-bold uppercase tracking-wide text-brand-teal sm:min-h-0"
              >
                {drinksOpen ? "Heißgetränke ausblenden" : "Heißgetränke anzeigen"}
              </button>
              {drinksOpen ? (
                prepProductsDrinks.length > 0 ? (
                  <ul className="mt-2 space-y-1.5">
                    {prepProductsDrinks.map((row) => (
                      <li key={row.name} className="rounded-lg border border-slate-100 bg-white px-2.5 py-2">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="min-w-0 break-words font-medium text-slate-700">{row.name}</span>
                          <span className="tabular-nums font-bold text-slate-900">{row.qty}×</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    Keine offenen Heißgetränke für diesen Tag. Es werden nur ausstehende Bestellungen gezählt.
                  </p>
                )
              ) : null}
            </div>
            {preparationSummary.menus.length > 0 ? (
              <div className="mt-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Menüs (Bestellungen)</p>
                <ul className="mt-2 space-y-1.5">
                  {preparationSummary.menus.map((row) => (
                    <li key={row.name} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 break-words font-medium text-slate-800">{row.name}</span>
                      <span className="tabular-nums font-bold text-brand-green">{row.qty}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap items-stretch gap-2">
              <button
                type="button"
                onClick={() => setPackOpen(true)}
                className="min-h-10 min-w-[9.5rem] flex-1 rounded-xl bg-brand-teal px-3 py-2 text-xs font-bold text-white hover:brightness-95 sm:text-sm"
              >
                Packliste anzeigen
              </button>
              <div className="flex min-h-10 min-w-[11rem] flex-1 items-center gap-1 rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setOrderListMode("open")}
                  className={`min-h-8 flex-1 rounded-lg px-2 py-1.5 text-xs font-bold transition sm:text-sm ${orderListMode === "open" ? "bg-brand-green text-white shadow-sm" : "text-slate-700 hover:bg-white/80"}`}
                >
                  Offen ({orderCounts.open})
                </button>
                <button
                  type="button"
                  onClick={() => setOrderListMode("done")}
                  className={`min-h-8 flex-1 rounded-lg px-2 py-1.5 text-xs font-bold transition sm:text-sm ${orderListMode === "done" ? "bg-brand-green text-white shadow-sm" : "text-slate-700 hover:bg-white/80"}`}
                >
                  Erledigt ({orderCounts.done})
                </button>
              </div>
              {orderListMode === "done" && orders.length > 0 ? (
                <button
                  type="button"
                  onClick={clearDoneFromStaffList}
                  disabled={clearingDone}
                  className="min-h-10 shrink-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:text-sm"
                >
                  {clearingDone ? "…" : "Leeren"}
                </button>
              ) : null}
            </div>
          </section>
            </div>

            <div className="staff-dashboard-main min-w-0 space-y-5">
          <input
            className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/25 sm:py-3.5 sm:text-sm"
            placeholder="Suche nach Name oder Bestellnummer"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
      {err ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm leading-relaxed text-red-800 shadow-sm break-words">{err}</div>
      ) : null}
      {repeatSuccess ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4"
          onClick={() => setRepeatSuccess(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="repeat-success-title"
            className="w-full max-w-sm rounded-t-3xl bg-white p-6 text-center shadow-2xl sm:rounded-3xl sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="repeat-success-title" className="text-sm font-bold uppercase tracking-[0.16em] text-brand-green">
              Vorbestellung gespeichert
            </p>
            <p className="mt-2 text-xs font-medium text-slate-500">Bestellnummer für morgen</p>
            <p className="mt-3 text-6xl font-black tabular-nums leading-none tracking-tight text-brand-green sm:text-7xl">
              #{repeatSuccess.orderNumber ?? "—"}
            </p>
            <p className="mt-4 break-words text-lg font-bold text-slate-900">{repeatSuccess.customerName}</p>
            <p className="mt-2 text-sm text-slate-600">Abholung: morgen</p>
            {repeatSuccess.paidNow ? (
              <p className="mt-3">
                <span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-bold uppercase ${paymentBadgeClass(true)}`}>
                  Bezahlt
                </span>
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => setRepeatSuccess(null)}
              className="mt-6 min-h-12 w-full rounded-2xl bg-brand-green px-4 py-3 text-base font-bold text-white hover:brightness-95"
            >
              OK
            </button>
          </div>
        </div>
      ) : null}
      {loading ? (
        <p className="text-sm font-medium text-slate-600" aria-live="polite">
          Lädt…
        </p>
      ) : null}
      {!loading && orders.length === 0 ? (
        <div className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200/80 sm:p-8">
          <p className="font-semibold text-slate-800">
            {orderListMode === "done" ? "Keine erledigten Bestellungen" : "Keine offenen Bestellungen"}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">Andere Tagesansicht wählen oder die Suche löschen.</p>
        </div>
      ) : null}

      <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
        {orders.map((o) => {
          const paymentLabel = orderPaymentLabel(o, berlinTomorrowYmd, berlinTodayYmd);
          const isPrepaid = paymentLabel === "paid";
          return (
          <li key={o.id}>
            <button
              type="button"
              onClick={() => setDetailId(o.id)}
              className={`flex min-h-[220px] w-full flex-col rounded-2xl border px-4 py-4 text-left shadow-sm ring-1 transition hover:shadow-md active:scale-[0.99] sm:px-5 sm:py-4 ${
                isPrepaid
                  ? "border-brand-green/40 bg-brand-green/[0.07] ring-brand-green/25 hover:ring-brand-green/40"
                  : "border-slate-200/90 bg-white ring-slate-100 hover:ring-brand-teal/40"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Bestellnummer</p>
                  <p className="text-3xl font-black tabular-nums leading-none tracking-tight text-brand-green sm:text-[2rem]">
                    #{o.order_number}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {orderListMode === "done" ? (
                    <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase sm:text-xs ${statusBadgeClass(o.status)}`}>
                      {statusLabel(o.status)}
                    </span>
                  ) : null}
                  {paymentLabel ? (
                    <span
                      className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase sm:text-xs ${paymentBadgeClass(paymentLabel === "paid")}`}
                    >
                      {paymentLabel === "paid" ? "Bezahlt" : "Offen"}
                    </span>
                  ) : null}
                  <span className="inline-flex h-8 items-center rounded-lg border border-brand-teal/30 bg-brand-teal/10 px-2.5 text-[11px] font-bold text-brand-teal">
                    Details
                  </span>
                </div>
              </div>
              <p className="mt-3 break-words text-[18px] font-bold leading-tight text-slate-900 line-clamp-2">
                {parseEigenesMenueFromCustomerName(o.customer_name).cleanName}
              </p>
              <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">
                {o.pickup_date ? new Date(o.pickup_date).toLocaleDateString("de-DE") : "—"}
              </p>
              <p className="mt-1 text-base font-bold tabular-nums text-slate-900">{formatMoney(o.total_amount)}</p>
              <p className="mt-2 line-clamp-3 break-words text-sm leading-relaxed text-slate-600">
                {o.short_summary || o.items_summary || "—"}
              </p>
              <p className="mt-auto pt-3 text-[11px] text-slate-400">Tippen für alle Positionen</p>
            </button>
          </li>
          );
        })}
      </ul>
            </div>
          </div>

      {manualOpen ? (
        <div className="fixed inset-0 z-[85] flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4" onClick={() => setManualOpen(false)}>
          <div
            className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl sm:rounded-3xl sm:p-5"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Vor-Ort-Verkauf erfassen</h3>
                <p className="mt-1 text-sm text-slate-600">Wird als Quelle „staff“ gespeichert und erscheint direkt in der Tagesliste.</p>
              </div>
              <button type="button" onClick={() => setManualOpen(false)} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                Schließen
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Abholtag</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={`min-h-11 rounded-xl px-3 py-2.5 text-sm font-bold transition ${manualService === "today" ? "bg-brand-green text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                    onClick={() => {
                      setManualService("today");
                      setManualPaidNow(false);
                    }}
                  >
                    Heute
                  </button>
                  <button
                    type="button"
                    className={`min-h-11 rounded-xl px-3 py-2.5 text-sm font-bold transition ${manualService === "tomorrow" ? "bg-brand-green text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                    onClick={() => setManualService("tomorrow")}
                  >
                    Morgen
                  </button>
                </div>
              </div>

              <input
                className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                placeholder={manualService === "tomorrow" ? "Name (Pflicht)" : "Name (optional, sonst Vor-Ort-Verkauf)"}
                value={manualCustomerName}
                onChange={(e) => setManualCustomerName(e.target.value)}
                required={manualService === "tomorrow"}
              />

              {manualService === "tomorrow" ? (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Zahlung</p>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      className={`min-h-11 rounded-xl px-3 py-2.5 text-sm font-bold transition ${manualPaidNow ? "bg-brand-green text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                      onClick={() => setManualPaidNow(true)}
                    >
                      Jetzt bezahlt
                    </button>
                    <button
                      type="button"
                      className={`min-h-11 rounded-xl px-3 py-2.5 text-sm font-bold transition ${!manualPaidNow ? "bg-brand-green text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                      onClick={() => setManualPaidNow(false)}
                    >
                      Bei Abholung zahlen
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-4">
              <div className="rounded-2xl border border-slate-200 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Backwaren (Vor-Ort)</p>
                <div className="mt-2 space-y-2">
                  {manualCatalogLoading ? (
                    <p className="text-sm text-slate-500">Produkte werden geladen…</p>
                  ) : null}
                  {!manualCatalogLoading && (catalog.products || []).length === 0 ? (
                    <p className="text-sm leading-relaxed text-slate-500">
                      Keine Backwaren geladen.{" "}
                      <button type="button" className="font-semibold text-brand-green underline" onClick={() => void loadManualCatalog()}>
                        Erneut laden
                      </button>
                    </p>
                  ) : null}
                  {(catalog.products || []).map((p) => (
                    <div key={`mp-${p.id}`} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 flex-1 break-words font-medium text-slate-900">{p.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">{formatMoney(p.price)}</span>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          step={1}
                          inputMode="numeric"
                          placeholder="0"
                          aria-label={`Menge ${p.name}`}
                          className="min-h-10 w-16 rounded-lg border-2 border-slate-300 bg-white px-2 py-1 text-right text-base font-semibold text-slate-900"
                          value={manualProductQty[String(p.id)] ?? ""}
                          onChange={(e) =>
                            setManualProductQty((s) => ({
                              ...s,
                              [String(p.id)]: Math.max(0, Number(e.target.value || 0))
                            }))
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between rounded-2xl bg-brand-green px-4 py-3 text-white">
              <span className="text-sm font-medium text-white/80">Gesamtsumme</span>
              <span className="text-lg font-black">{formatMoney(manualTotal)}</span>
            </div>

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setManualOpen(false)}
                className="min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:min-h-0 sm:py-2"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={submitManualOrder}
                disabled={manualSubmitting}
                className="min-h-11 rounded-xl bg-brand-green px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-green disabled:opacity-60 sm:min-h-0 sm:py-2"
              >
                {manualSubmitting ? "Speichern…" : "Vor-Ort-Verkauf speichern"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {manualSuccess ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4"
          onClick={() => setManualSuccess(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="manual-success-title"
            className="w-full max-w-sm rounded-t-3xl bg-white p-6 text-center shadow-2xl sm:rounded-3xl sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="manual-success-title" className="text-sm font-bold uppercase tracking-[0.16em] text-brand-green">
              Bestellung gespeichert
            </p>
            <p className="mt-2 text-xs font-medium text-slate-500">Bestellnummer für den Gast</p>
            <p className="mt-3 text-6xl font-black tabular-nums leading-none tracking-tight text-brand-green sm:text-7xl">
              #{manualSuccess.orderNumber ?? "—"}
            </p>
            <p className="mt-4 break-words text-lg font-bold text-slate-900">{manualSuccess.customerName}</p>
            {manualSuccess.pickupDay === "tomorrow" ? (
              <p className="mt-2 text-sm text-slate-600">Abholung: morgen</p>
            ) : null}
            {manualSuccess.paidNow ? (
              <p className="mt-3">
                <span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-bold uppercase ${paymentBadgeClass(true)}`}>
                  Bezahlt
                </span>
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => setManualSuccess(null)}
              className="mt-6 min-h-12 w-full rounded-2xl bg-brand-green px-4 py-3 text-base font-bold text-white hover:brightness-95"
            >
              OK
            </button>
          </div>
        </div>
      ) : null}

      {detailOrder ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4"
          onClick={closeDetail}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[92dvh] w-full max-w-lg overflow-y-auto overscroll-y-contain rounded-t-3xl bg-white shadow-2xl sm:max-h-[90dvh] sm:rounded-3xl [-webkit-overflow-scrolling:touch]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] backdrop-blur-sm sm:px-5 sm:py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Bestellnummer</p>
                  <button
                    type="button"
                    onClick={tapOrderNumberForOverride}
                    className="text-left text-4xl font-black tabular-nums text-brand-green sm:text-5xl"
                    aria-label={`Bestellnummer ${detailOrder.order_number}`}
                  >
                    #{detailOrder.order_number}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={closeDetail}
                  className="min-h-10 shrink-0 rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 active:bg-slate-200 sm:min-h-0 sm:py-1.5"
                >
                  Schließen
                </button>
              </div>
              <p className="mt-3 break-words text-lg font-bold leading-snug text-slate-900 sm:text-xl">{detailNameParts.cleanName}</p>
              <p className="mt-1 text-sm text-slate-500">
                Status: <span className="font-semibold text-slate-800">{statusLabel(detailOrder.status)}</span>
              </p>
              {detailPaymentLabel ? (
                <p className="mt-1 text-sm text-slate-500">
                  Zahlung:{" "}
                  <span
                    className={`inline-flex rounded-lg border px-2 py-0.5 text-xs font-bold uppercase ${paymentBadgeClass(detailPaymentLabel === "paid")}`}
                  >
                    {detailPaymentLabel === "paid" ? "Bezahlt" : "Offen"}
                  </span>
                </p>
              ) : null}
              {detailOrder.status === "not_picked_up" && detailOrder.not_picked_up_reason ? (
                <p className="mt-1 text-xs text-slate-500">
                  Grund:{" "}
                  <span className="font-semibold text-slate-700">
                    {NOT_PICKED_UP_REASON_OPTIONS.find((x) => x.value === detailOrder.not_picked_up_reason)?.label ||
                      detailOrder.not_picked_up_reason}
                  </span>
                  {detailOrder.not_picked_up_note ? ` · ${detailOrder.not_picked_up_note}` : ""}
                </p>
              ) : null}
              {["pending", "delivered", "not_picked_up"].includes(detailOrder.status) ? (
                <button
                  type="button"
                  onClick={() => {
                    setRepeatSuccess(null);
                    setRepeatOrder(detailOrder);
                  }}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-brand-yellow/50 bg-brand-yellow/15 px-3 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-brand-yellow/25 active:bg-brand-yellow/30"
                >
                  <span className="text-base leading-none" aria-hidden>
                    📅
                  </span>
                  Für morgen vorbestellen
                </button>
              ) : null}
            </div>

            <div className="space-y-3 px-4 py-4 sm:px-5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Positionen</p>
              {(detailOrder.order_items || []).length === 0 ? (
                <p className="text-sm text-slate-500">Keine Zeilen.</p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-slate-50/50">
                  {detailOrder.order_items.map((i) => {
                    const isMenu = Boolean(i.menus?.name);
                    const label = i.products?.name || i.menus?.name || "—";
                    const lineTotal = Number(i.quantity || 0) * Number(i.unit_price || 0);
                    const menuLines = isMenu ? menuCompositionLinesFromDescription(i.menus?.description) : [];
                    const menuStruct = Array.isArray(i.menus?.menu_items) ? i.menus.menu_items : [];
                    return (
                      <li key={i.id} className="flex gap-3 px-4 py-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-yellow/25 text-lg">{isMenu ? "📋" : "🥐"}</div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold uppercase text-brand-green/90">{isMenu ? "Menü" : "Produkt"}</p>
                          <p className="break-words font-semibold text-slate-900">{label}</p>
                          <p className="mt-1 text-sm text-slate-600">
                            {i.quantity} × {formatMoney(i.unit_price)}
                            <span className="font-medium text-slate-800"> · {formatMoney(lineTotal)}</span>
                          </p>
                          {isMenu ? (
                            <div className="mt-3 rounded-xl border border-brand-yellow/30 bg-brand-yellow/15 px-3 py-2">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-brand-green/90">Inhalt (je Menü)</p>
                              {menuStruct.length > 0 ? (
                                <ul className="mt-2 space-y-1.5 border-l-2 border-brand-yellow/50 pl-3 text-sm text-slate-800">
                                  {menuStruct.map((mi, li) => (
                                    <li key={`${mi.product_id}-${li}`} className="leading-snug">
                                      <span className="text-brand-orange">–</span> {mi.quantity}× {mi.products?.name || "—"}
                                    </li>
                                  ))}
                                </ul>
                              ) : menuLines.length > 0 ? (
                                <ul className="mt-2 space-y-1.5 border-l-2 border-brand-yellow/50 pl-3 text-sm text-slate-800">
                                  {menuLines.map((line, li) => (
                                    <li key={li} className="leading-snug">
                                      <span className="text-brand-orange">–</span> {line}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="mt-1.5 text-sm italic leading-relaxed text-slate-600">
                                  Keine Beschreibung hinterlegt. Bitte im Admin unter Menü eine Zusammenstellung eintragen (z. B. „2× Buttercroissant + 1× Kaffee“).
                                </p>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {detailNameParts.groups.length > 0 ? (
                <div className="mt-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Eigenes Menü (Zusatz)</p>
                  <ul className="mt-2 divide-y divide-slate-100 rounded-2xl border border-brand-yellow/25 bg-brand-yellow/15">
                    {detailNameParts.groups.map((grp, gi) => (
                      <li key={`em-g-${gi}`} className="px-0 py-0">
                        {detailNameParts.groups.length > 1 ? (
                          <p className="border-b border-brand-yellow/25 bg-brand-yellow/25/50 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-brand-green">
                            Komposition {gi + 1}
                          </p>
                        ) : null}
                        <ul>
                          {grp.jams.map((j, ji) => (
                            <li key={`jam-${gi}-${ji}`} className="flex gap-3 px-4 py-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-lg ring-1 ring-brand-yellow/25">{j.icon}</div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold uppercase text-brand-green/90">Marmelade</p>
                                <p className="font-semibold text-slate-900">{j.label}</p>
                                <p className="mt-1 text-sm text-slate-600">{j.qty} × Portion</p>
                              </div>
                            </li>
                          ))}
                          {grp.drink ? (
                            <li className="flex gap-3 px-4 py-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-lg ring-1 ring-brand-yellow/25">{grp.drink.icon}</div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold uppercase text-brand-green/90">Getränk</p>
                                <p className="font-semibold text-slate-900">{grp.drink.label}</p>
                                <p className="mt-1 text-sm text-slate-600">1 ×</p>
                              </div>
                            </li>
                          ) : null}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="flex items-center justify-between rounded-2xl bg-brand-green px-4 py-3 text-white">
                <span className="text-sm font-medium text-white/80">Summe</span>
                <span className="text-lg font-black">{formatMoney(detailOrder.total_amount)}</span>
              </div>
            </div>

            <div className="sticky bottom-0 border-t border-slate-100 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px)+0.75rem)] sm:p-5 sm:pb-5">
              {canCompletePickupToday ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => deliver(detailOrder.id)}
                    className="min-h-12 w-full rounded-2xl bg-brand-green py-3.5 text-sm font-bold text-white shadow-md hover:bg-brand-green active:bg-brand-green"
                  >
                    Als ausgeliefert markieren
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNotPickedUpReason(DEFAULT_NOT_PICKED_UP_REASON);
                      setNotPickedUpNote("");
                      setConfirmNotPickedUpId(detailOrder.id);
                    }}
                    className="min-h-12 w-full rounded-2xl bg-brand-teal py-3.5 text-sm font-bold text-white shadow-md hover:brightness-95 active:brightness-90"
                  >
                    Nicht abgeholt
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {orderListMode === "open" &&
                  detailOrder.status === "pending" &&
                  orderPickupYmd(detailOrder.pickup_date) === berlinTomorrowYmd ? (
                    <p className="text-center text-xs leading-relaxed text-slate-500">
                      Auslieferung und „Nicht abgeholt“ sind erst am Abholtag möglich.
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={closeDetail}
                    className="min-h-12 w-full rounded-2xl bg-brand-orange py-3.5 text-sm font-bold text-white hover:brightness-95"
                  >
                    Schließen
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <StaffOrderOverridePanel
        open={overrideOpen}
        order={detailOrder}
        apiPrefix={apiPrefix}
        catalog={catalog}
        unlocked={overrideUnlocked}
        onUnlocked={() => setOverrideUnlocked(true)}
        onClose={() => setOverrideOpen(false)}
        onSuccess={async () => {
          setOverrideOpen(false);
          await load();
        }}
      />

      {packOpen ? (
        <div
          data-packliste-print-overlay="true"
          className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4"
          onClick={() => setPackOpen(false)}
        >
          <div
            data-packliste-print-dialog="true"
            className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl sm:rounded-3xl sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              data-packliste-print-card="true"
              className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50/80 to-white p-3 shadow-sm sm:p-4"
            >
              <div className="mb-3 flex items-center justify-end gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={printPackliste}
                    className="rounded-full bg-brand-orange px-3 py-1.5 text-xs font-bold text-white"
                  >
                    Packliste drucken
                  </button>
                  <button
                    type="button"
                    onClick={() => setPackOpen(false)}
                    className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
                  >
                    Schließen
                  </button>
                </div>
              </div>
            <p className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">Packliste-Matrix</p>
            <div id="packliste-print-area" className="max-h-[66dvh] overflow-auto rounded-xl border border-slate-200 bg-white">
              <div className="packliste-print-only packliste-print-summary" aria-hidden="true">
                <p className="packliste-print-summary-title">Gesamt für heute</p>
                <div className="packliste-print-summary-grid">
                  {packlistePrintSummaryCounts.map(({ name, qty }) => (
                    <div key={name} className="packliste-print-summary-cell">
                      <span className="packliste-print-summary-name">{name}:</span>{" "}
                      <span className="packliste-print-summary-qty">{qty}</span>
                    </div>
                  ))}
                </div>
              </div>
              <table className="min-w-full text-xs packliste-print-matrix-table">
                <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur">
                  <tr>
                    <th className="sticky left-0 z-20 bg-slate-100/95 px-3 py-2.5 text-left font-bold text-slate-700">Bestellnr.</th>
                    {matrixProductsPrimary.map((p) => (
                      <th key={p.name} className="px-3 py-2.5 text-left font-bold text-slate-700">
                        <div className="whitespace-nowrap">{p.name}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrixOrderNumbers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={Math.max(1, matrixProductsPrimary.length + 1)}
                        className="px-3 py-6 text-center text-sm text-slate-500"
                      >
                        Keine Positionen für die Matrix an diesem Tag (ohne Heißgetränke).
                      </td>
                    </tr>
                  ) : (
                    matrixOrderNumbers.map((n) => (
                      <tr key={n} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/50">
                        <td className="sticky left-0 bg-inherit px-3 py-2 font-semibold text-slate-700">
                          <span className="inline-flex rounded-full bg-slate-200/80 px-2 py-0.5 text-[11px]">#{n}</span>
                        </td>
                        {matrixProductsPrimary.map((p) => {
                          const q = (p.per_order || []).find((x) => Number(x.order_number) === n)?.qty || 0;
                          return (
                            <td key={`${n}-${p.name}`} className="px-3 py-2 text-center text-slate-700">
                              {q > 0 ? `${q}x` : ""}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {confirmNotPickedUpId ? (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/55 p-4"
          onClick={() => {
            setConfirmNotPickedUpId(null);
            setNotPickedUpReason(DEFAULT_NOT_PICKED_UP_REASON);
            setNotPickedUpNote("");
          }}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-no-show-title"
          >
            <h3 id="confirm-no-show-title" className="text-lg font-bold text-slate-900">
              Nicht abgeholt erfassen
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              Bitte Grund auswählen. Optional können Sie eine kurze Notiz ergänzen.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor="not-picked-up-reason" className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Grund
                </label>
                <select
                  id="not-picked-up-reason"
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"
                  value={notPickedUpReason}
                  onChange={(e) => setNotPickedUpReason(e.target.value)}
                >
                  {NOT_PICKED_UP_REASON_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="not-picked-up-note" className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Notiz (optional)
                </label>
                <textarea
                  id="not-picked-up-note"
                  rows={3}
                  maxLength={2000}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  value={notPickedUpNote}
                  onChange={(e) => setNotPickedUpNote(e.target.value)}
                  placeholder="z. B. Doppelbestellung mit Nummer #123 storniert"
                />
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setConfirmNotPickedUpId(null);
                  setNotPickedUpReason(DEFAULT_NOT_PICKED_UP_REASON);
                  setNotPickedUpNote("");
                }}
                className="min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:min-h-0 sm:py-2"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => markNotPickedUp(confirmNotPickedUpId)}
                className="min-h-11 rounded-xl bg-brand-orange px-4 py-2.5 text-sm font-bold text-white hover:brightness-95 sm:min-h-0 sm:py-2"
              >
                Bestätigen
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "orders" ? (
        <div className="pointer-events-none fixed right-2 top-1/2 z-[25] flex -translate-y-1/2 flex-col gap-2 sm:right-3">
          <button
            type="button"
            title="Nach oben"
            aria-label="Nach oben scrollen"
            disabled={!canScrollUp}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/90 bg-white text-lg font-bold text-brand-green shadow-md ring-1 ring-slate-100 transition hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-35 sm:h-11 sm:w-11"
          >
            ↑
          </button>
          <button
            type="button"
            title="Nach unten"
            aria-label="Nach unten scrollen"
            disabled={!canScrollDown}
            onClick={() =>
              window.scrollTo({
                top: document.documentElement.scrollHeight,
                behavior: "smooth"
              })
            }
            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/90 bg-white text-lg font-bold text-brand-green shadow-md ring-1 ring-slate-100 transition hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-35 sm:h-11 sm:w-11"
          >
            ↓
          </button>
        </div>
      ) : null}

      <StaffRepeatOrderModal
        open={Boolean(repeatOrder)}
        order={repeatOrder}
        catalog={catalog}
        apiPrefix={apiPrefix}
        onClose={() => setRepeatOrder(null)}
        onCreated={(data) => {
          setRepeatOrder(null);
          setDetailId(null);
          setRepeatSuccess({
            orderNumber: data?.orderNumber ?? null,
            customerName: data?.customerName ?? "",
            paidNow: Boolean(data?.paidNow)
          });
          void load();
        }}
      />
        </>
      ) : null}
    </div>
  );
}
