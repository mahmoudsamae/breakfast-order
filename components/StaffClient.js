"use client";

import { useEffect, useMemo, useState } from "react";
import { parseEigenesMenueFromCustomerName } from "@/lib/eigenes-menue";
import { menuCompositionLinesFromDescription } from "@/lib/staff-menu-display";
import { formatMoney } from "@/lib/format-money";
import RegistrationsStaffSection from "@/components/RegistrationsStaffSection";

const FIXED_PACKLIST_PRODUCTS = ["Knusperbrötchen", "Farmerbrötchen", "Laugenbrezel", "Buttercroissant"];

function statusLabel(s) {
  if (s === "pending") return "Ausstehend";
  if (s === "delivered") return "Ausgeliefert";
  if (s === "not_picked_up") return "Nicht abgeholt";
  return s || "—";
}

export default function StaffClient({ apiPrefix = "/api/staff" }) {
  const [activeTab, setActiveTab] = useState("orders");
  const [service, setService] = useState("today");
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
  const [manualOpen, setManualOpen] = useState(false);
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualCustomerName, setManualCustomerName] = useState("");
  const [manualPickupDate, setManualPickupDate] = useState("");
  const [manualProductQty, setManualProductQty] = useState({});

  async function load() {
    setLoading(true);
    setErr("");
    const res = await fetch(`${apiPrefix}/orders?service=${service}&q=${encodeURIComponent(q)}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) setErr(data.error || "Fehler beim Laden.");
    setOrders(data.orders || []);
    setPreparationSummary(
      data.preparationSummary || {
        products: [],
        menus: []
      }
    );
    setPreparationPacklist(data.preparationPacklist || []);
    setDayMatrixPacklist(data.dayMatrixPacklist || []);
    setPickupDateLabel(data.pickupDate || "");
    setCatalog(data.catalog || { products: [], menus: [] });
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, q, apiPrefix]);

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
    const res = await fetch(`${apiPrefix}/orders/${id}/not-picked-up`, { method: "PATCH" });
    if (!res.ok) {
      const data = await res.json();
      setErr(data.error || "Status konnte nicht gesetzt werden.");
      return;
    }
    setDetailId(null);
    setConfirmNotPickedUpId(null);
    await load();
  }

  useEffect(() => {
    if (!confirmNotPickedUpId) return;
    function onKeyDown(e) {
      if (e.key === "Escape") setConfirmNotPickedUpId(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmNotPickedUpId]);

  const detailOrder = detailId ? orders.find((o) => o.id === detailId) : null;
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
  const matrixProductsPrimary = useMemo(
    () => (dayMatrixPacklist || []).filter((x) => x.category !== "getraenke"),
    [dayMatrixPacklist]
  );
  const matrixOrderNumbers = useMemo(() => {
    const s = new Set();
    for (const p of matrixProductsPrimary) for (const x of p.per_order || []) s.add(Number(x.order_number));
    return [...s].sort((a, b) => a - b);
  }, [matrixProductsPrimary]);
  const manualTotal = useMemo(() => {
    let sum = 0;
    for (const p of catalog.products || []) {
      const qty = Number(manualProductQty[String(p.id)] || 0);
      if (qty > 0) sum += qty * Number(p.price || 0);
    }
    return Math.round(sum * 100) / 100;
  }, [catalog, manualProductQty]);
  const fixedPacklistRows = useMemo(() => {
    const qtyByName = new Map();
    for (const row of prepProductsPrimary) {
      qtyByName.set(String(row.name || "").trim().toLowerCase(), Number(row.qty || 0));
    }
    return FIXED_PACKLIST_PRODUCTS.map((name) => ({
      name,
      qty: qtyByName.get(name.toLowerCase()) || 0
    }));
  }, [prepProductsPrimary]);

  function todayIsoLocal() {
    return new Date().toLocaleDateString("en-CA");
  }

  function openManualOrder() {
    setErr("");
    setManualPickupDate(todayIsoLocal());
    setManualCustomerName("");
    setManualProductQty({});
    setManualOpen(true);
  }

  async function submitManualOrder() {
    setErr("");
    setManualSubmitting(true);
    const payload = {
      customerName: manualCustomerName.trim(),
      pickupDate: manualPickupDate || todayIsoLocal(),
      productQuantities: manualProductQty
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
    await load();
  }

  function printPackliste() {
    if (typeof window === "undefined") return;
    const cls = "print-packliste-only";
    const cleanup = () => {
      document.body.classList.remove(cls);
      window.removeEventListener("afterprint", cleanup);
    };
    document.body.classList.add(cls);
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
    setTimeout(cleanup, 1200);
  }

  return (
    <div className="space-y-5 pb-6 sm:space-y-6 sm:pb-8">
      <section className="rounded-3xl bg-gradient-to-br from-amber-600 via-orange-500 to-rose-500 p-5 text-white shadow-xl sm:p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-white/75">Team</p>
        <h1 className="mt-2 text-xl font-bold leading-tight sm:text-2xl">Staff-Dashboard</h1>
        <p className="mt-2 text-sm leading-snug text-white/90">Erleichtert die Abläufe für Team und Gäste.</p>
        {activeTab === "orders" ? (
          <div className="mt-4">
            <button
              type="button"
              onClick={openManualOrder}
              className="min-h-11 rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-amber-900 shadow-md"
            >
              + Vor-Ort-Verkauf
            </button>
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-slate-200/90 bg-white p-3 shadow-sm sm:p-4">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("orders")}
            className={`min-h-11 rounded-2xl px-3 py-2 text-sm font-bold transition ${activeTab === "orders" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
          >
            Bestellungen
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("registrations")}
            className={`min-h-11 rounded-2xl px-3 py-2 text-sm font-bold transition ${activeTab === "registrations" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
          >
            Registrierungen
          </button>
        </div>
      </section>

      {activeTab === "registrations" ? <RegistrationsStaffSection apiPrefix={apiPrefix} /> : null}
      {activeTab === "orders" ? (
        <>
          <section className="rounded-3xl bg-gradient-to-br from-amber-600/90 via-orange-500/90 to-rose-500/90 p-4 text-white shadow-md sm:p-5">
            <p className="text-sm font-semibold">Bestellansicht</p>
            <p className="mt-1 text-xs text-white/90">Schnell erfassen, ausliefern und im Blick behalten.</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3">
              <button
                type="button"
                className={`min-h-12 rounded-2xl px-3 py-2.5 text-sm font-bold transition active:scale-[0.99] sm:min-h-0 ${service === "today" ? "bg-white text-amber-900 shadow-md" : "bg-white/15 text-white hover:bg-white/25"}`}
                onClick={() => setService("today")}
              >
                Heute
              </button>
              <button
                type="button"
                className={`min-h-12 rounded-2xl px-3 py-2.5 text-sm font-bold transition active:scale-[0.99] sm:min-h-0 ${service === "tomorrow" ? "bg-white text-amber-900 shadow-md" : "bg-white/15 text-white hover:bg-white/25"}`}
                onClick={() => setService("tomorrow")}
              >
                Morgen
              </button>
            </div>
          </section>

      <section className="rounded-3xl border border-amber-200/80 bg-white p-4 shadow-md ring-1 ring-slate-200/90 sm:p-5">
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
            <ul className="mt-2 space-y-2">
              {prepProductsPrimary.map((row) => (
                <li key={row.name} className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 break-words font-medium text-slate-800">{row.name}</span>
                    <span className="tabular-nums text-base font-black text-amber-900">{row.qty}x</span>
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
            className="min-h-10 w-full text-left text-xs font-bold uppercase tracking-wide text-slate-700 sm:min-h-0"
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
                      <span className="tabular-nums font-bold text-slate-900">{row.qty}x</span>
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
                  <span className="tabular-nums font-bold text-amber-900">{row.qty}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setPackOpen(true)}
            className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white"
          >
            Packliste anzeigen
          </button>
        </div>
      </section>

      <input
        className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none ring-amber-500/0 transition placeholder:text-slate-400 focus:border-amber-300 focus:ring-2 focus:ring-amber-200/50 sm:py-3.5 sm:text-sm"
        placeholder="Suche nach Name oder Bestellnummer"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {err ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm leading-relaxed text-red-800 shadow-sm break-words">{err}</div>
      ) : null}
      {loading ? (
        <p className="text-sm font-medium text-slate-600" aria-live="polite">
          Lädt…
        </p>
      ) : null}
      {!loading && orders.length === 0 ? (
        <div className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200/80 sm:p-8">
          <p className="font-semibold text-slate-800">Keine offenen Bestellungen</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">Andere Tagesansicht wählen oder die Suche löschen.</p>
        </div>
      ) : null}

      <ul className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
        {orders.map((o) => (
          <li key={o.id}>
            <button
              type="button"
              onClick={() => setDetailId(o.id)}
              className="flex min-h-[220px] w-full flex-col rounded-2xl border border-slate-200/90 bg-white px-4 py-4 text-left shadow-sm ring-1 ring-slate-100 transition hover:shadow-md hover:ring-amber-200/80 active:scale-[0.99] sm:px-5 sm:py-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Bestellnummer</p>
                  <p className="text-2xl font-black tabular-nums leading-none tracking-tight text-amber-950 sm:text-[30px]">#{o.order_number}</p>
                </div>
                <span className="inline-flex h-8 shrink-0 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-bold text-slate-700 shadow-sm">
                  Details
                </span>
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
        ))}
      </ul>

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

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input
                className="min-h-11 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                placeholder="Name (optional)"
                value={manualCustomerName}
                onChange={(e) => setManualCustomerName(e.target.value)}
              />
              <input
                type="date"
                className="min-h-11 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                value={manualPickupDate}
                onChange={(e) => setManualPickupDate(e.target.value)}
              />
            </div>

            <div className="mt-4">
              <div className="rounded-2xl border border-slate-200 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Backwaren (Vor-Ort)</p>
                <div className="mt-2 space-y-2">
                  {(catalog.products || []).map((p) => (
                    <div key={`mp-${p.id}`} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 flex-1 break-words">{p.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">{formatMoney(p.price)}</span>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-right"
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

            <div className="mt-5 flex items-center justify-between rounded-2xl bg-slate-900 px-4 py-3 text-white">
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
                className="min-h-11 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60 sm:min-h-0 sm:py-2"
              >
                {manualSubmitting ? "Speichern…" : "Vor-Ort-Verkauf speichern"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {detailOrder ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4"
          onClick={() => setDetailId(null)}
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
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Bestellnummer</p>
                  <p className="text-2xl font-black tabular-nums text-slate-900 sm:text-3xl">#{detailOrder.order_number}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailId(null)}
                  className="min-h-10 shrink-0 rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 active:bg-slate-200 sm:min-h-0 sm:py-1.5"
                >
                  Schließen
                </button>
              </div>
              <p className="mt-3 break-words text-lg font-bold leading-snug text-slate-900 sm:text-xl">{detailNameParts.cleanName}</p>
              <p className="mt-1 text-sm text-slate-500">
                Status: <span className="font-semibold text-slate-800">{statusLabel(detailOrder.status)}</span>
              </p>
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
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-lg">{isMenu ? "📋" : "🥐"}</div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold uppercase text-amber-800/90">{isMenu ? "Menü" : "Produkt"}</p>
                          <p className="break-words font-semibold text-slate-900">{label}</p>
                          <p className="mt-1 text-sm text-slate-600">
                            {i.quantity} × {formatMoney(i.unit_price)}
                            <span className="font-medium text-slate-800"> · {formatMoney(lineTotal)}</span>
                          </p>
                          {isMenu ? (
                            <div className="mt-3 rounded-xl border border-amber-100/90 bg-amber-50/50 px-3 py-2">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800/90">Inhalt (je Menü)</p>
                              {menuStruct.length > 0 ? (
                                <ul className="mt-2 space-y-1.5 border-l-2 border-amber-200/80 pl-3 text-sm text-slate-800">
                                  {menuStruct.map((mi, li) => (
                                    <li key={`${mi.product_id}-${li}`} className="leading-snug">
                                      <span className="text-amber-700">–</span> {mi.quantity}× {mi.products?.name || "—"}
                                    </li>
                                  ))}
                                </ul>
                              ) : menuLines.length > 0 ? (
                                <ul className="mt-2 space-y-1.5 border-l-2 border-amber-200/80 pl-3 text-sm text-slate-800">
                                  {menuLines.map((line, li) => (
                                    <li key={li} className="leading-snug">
                                      <span className="text-amber-700">–</span> {line}
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
                  <ul className="mt-2 divide-y divide-slate-100 rounded-2xl border border-amber-100 bg-amber-50/40">
                    {detailNameParts.groups.map((grp, gi) => (
                      <li key={`em-g-${gi}`} className="px-0 py-0">
                        {detailNameParts.groups.length > 1 ? (
                          <p className="border-b border-amber-100/80 bg-amber-100/50 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-amber-900">
                            Komposition {gi + 1}
                          </p>
                        ) : null}
                        <ul>
                          {grp.jams.map((j, ji) => (
                            <li key={`jam-${gi}-${ji}`} className="flex gap-3 px-4 py-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-lg ring-1 ring-amber-100">{j.icon}</div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold uppercase text-amber-800/90">Marmelade</p>
                                <p className="font-semibold text-slate-900">{j.label}</p>
                                <p className="mt-1 text-sm text-slate-600">{j.qty} × Portion</p>
                              </div>
                            </li>
                          ))}
                          {grp.drink ? (
                            <li className="flex gap-3 px-4 py-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-lg ring-1 ring-amber-100">{grp.drink.icon}</div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold uppercase text-amber-800/90">Getränk</p>
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

              <div className="flex items-center justify-between rounded-2xl bg-slate-900 px-4 py-3 text-white">
                <span className="text-sm font-medium text-white/80">Summe</span>
                <span className="text-lg font-black">{formatMoney(detailOrder.total_amount)}</span>
              </div>
            </div>

            <div className="sticky bottom-0 border-t border-slate-100 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px)+0.75rem)] sm:p-5 sm:pb-5">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => deliver(detailOrder.id)}
                  className="min-h-12 w-full rounded-2xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-md hover:bg-emerald-700 active:bg-emerald-800"
                >
                  Als ausgeliefert markieren
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmNotPickedUpId(detailOrder.id)}
                  className="min-h-12 w-full rounded-2xl bg-slate-700 py-3.5 text-sm font-bold text-white shadow-md hover:bg-slate-800 active:bg-slate-900"
                >
                  Nicht abgeholt
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {packOpen ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4" onClick={() => setPackOpen(false)}>
          <div
            className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl sm:rounded-3xl sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50/80 to-white p-3 shadow-sm sm:p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Packliste-Matrix</h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={printPackliste}
                    className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-bold text-white"
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
              <div id="packliste-print-area" className="max-h-[66dvh] overflow-auto rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
                <div className="packlist-sheet">
                  <p className="packlist-title">Packliste Fruehstueck</p>
                  <p className="packlist-date">{pickupDateLabel ? `Datum: ${pickupDateLabel}` : "Datum: -"}</p>
                  <table className="packlist-main-table">
                    <thead>
                      <tr>
                        <th>Produkt</th>
                        <th className="qty-col">Menge</th>
                        <th className="check-col">Check</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fixedPacklistRows.map((row) => (
                        <tr key={`fixed-pack-${row.name}`}>
                          <td>{row.name}</td>
                          <td className="qty-col">{row.qty}</td>
                          <td className="check-col"></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="packlist-screen-only mt-4">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Detail pro Bestellnummer</p>
                  <table className="min-w-full text-xs">
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
        </div>
      ) : null}
      <style jsx global>{`
        @media print {
          body.print-packliste-only * {
            visibility: hidden !important;
          }
          body.print-packliste-only #packliste-print-area,
          body.print-packliste-only #packliste-print-area * {
            visibility: visible !important;
          }
          body.print-packliste-only #packliste-print-area {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-height: none !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 10mm !important;
            border: none !important;
            border-radius: 0 !important;
            background: #fff !important;
          }
          body.print-packliste-only .packlist-screen-only {
            display: none !important;
          }
          body.print-packliste-only .packlist-sheet {
            padding: 0 !important;
          }
          body.print-packliste-only .packlist-title {
            font-size: 20px !important;
            font-weight: 800 !important;
            color: #0f172a !important;
            margin: 0 0 4mm !important;
          }
          body.print-packliste-only .packlist-date {
            font-size: 13px !important;
            color: #334155 !important;
            margin: 0 0 5mm !important;
          }
          body.print-packliste-only .packlist-main-table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 13px !important;
            color: #0f172a !important;
          }
          body.print-packliste-only .packlist-main-table th,
          body.print-packliste-only .packlist-main-table td {
            border: 1px solid #cbd5e1 !important;
            padding: 3.5mm 3mm !important;
            vertical-align: middle !important;
          }
          body.print-packliste-only .packlist-main-table th {
            background: #f8fafc !important;
            font-size: 12px !important;
            font-weight: 700 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.04em !important;
          }
          body.print-packliste-only .packlist-main-table td:first-child {
            font-weight: 700 !important;
          }
          body.print-packliste-only .packlist-main-table .qty-col {
            width: 22mm !important;
            text-align: center !important;
            font-weight: 800 !important;
          }
          body.print-packliste-only .packlist-main-table .check-col {
            width: 28mm !important;
          }
        }
      `}</style>
      {confirmNotPickedUpId ? (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/55 p-4"
          onClick={() => setConfirmNotPickedUpId(null)}
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
              Bestellung bestätigen
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              Möchten Sie diese Bestellung wirklich als 'nicht abgeholt' markieren?
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmNotPickedUpId(null)}
                className="min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:min-h-0 sm:py-2"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => markNotPickedUp(confirmNotPickedUpId)}
                className="min-h-11 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 sm:min-h-0 sm:py-2"
              >
                Bestätigen
              </button>
            </div>
          </div>
        </div>
      ) : null}
        </>
      ) : null}
    </div>
  );
}
