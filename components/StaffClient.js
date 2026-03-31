"use client";

import { useEffect, useMemo, useState } from "react";
import { parseEigenesMenueFromCustomerName } from "@/lib/eigenes-menue";
import { menuCompositionLinesFromDescription } from "@/lib/staff-menu-display";
import { formatMoney } from "@/lib/format-money";

function statusLabel(s) {
  if (s === "pending") return "Ausstehend";
  if (s === "delivered") return "Ausgeliefert";
  return s || "—";
}

export default function StaffClient() {
  const [service, setService] = useState("today");
  const [q, setQ] = useState("");
  const [orders, setOrders] = useState([]);
  const [preparationSummary, setPreparationSummary] = useState({ products: [], menus: [] });
  const [pickupDateLabel, setPickupDateLabel] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState(null);

  async function load() {
    setLoading(true);
    setErr("");
    const res = await fetch(`/api/staff/orders?service=${service}&q=${encodeURIComponent(q)}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) setErr(data.error || "Fehler beim Laden.");
    setOrders(data.orders || []);
    setPreparationSummary(
      data.preparationSummary || {
        products: [],
        menus: []
      }
    );
    setPickupDateLabel(data.pickupDate || "");
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, q]);

  async function deliver(id) {
    const res = await fetch(`/api/staff/orders/${id}/deliver`, { method: "PATCH" });
    if (!res.ok) {
      const data = await res.json();
      setErr(data.error || "Status konnte nicht gesetzt werden.");
      return;
    }
    setDetailId(null);
    setOrders((prev) => prev.filter((o) => o.id !== id));
  }

  const detailOrder = detailId ? orders.find((o) => o.id === detailId) : null;
  const detailNameParts = useMemo(
    () => (detailOrder ? parseEigenesMenueFromCustomerName(detailOrder.customer_name) : { cleanName: "", groups: [] }),
    [detailOrder]
  );

  return (
    <div className="space-y-5 pb-6 sm:space-y-6 sm:pb-8">
      <section className="rounded-3xl bg-gradient-to-br from-amber-600 via-orange-500 to-rose-500 p-5 text-white shadow-xl sm:p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-white/75">Team</p>
        <h1 className="mt-2 text-xl font-bold leading-tight sm:text-2xl">Offene Bestellungen</h1>
        <p className="mt-2 text-sm leading-snug text-white/90">Karte antippen für Details · Suche nach Name oder Bestellnummer</p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3">
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
        {preparationSummary.products.length > 0 ? (
          <div className="mt-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Produkte (Stück)</p>
            <ul className="mt-2 space-y-1.5">
              {preparationSummary.products.map((row) => (
                <li key={row.name} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 break-words font-medium text-slate-800">{row.name}</span>
                  <span className="tabular-nums font-bold text-amber-900">{row.qty}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
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

      <ul className="space-y-3 sm:space-y-4">
        {orders.map((o) => (
          <li key={o.id}>
            <button
              type="button"
              onClick={() => setDetailId(o.id)}
              className="w-full rounded-3xl bg-white p-4 text-left shadow-md ring-1 ring-slate-200/90 transition hover:shadow-lg hover:ring-amber-200/80 active:scale-[0.99] sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Bestellnummer</p>
                  <p className="text-2xl font-black tabular-nums tracking-tight text-slate-900 sm:text-3xl">#{o.order_number}</p>
                </div>
                <span className="shrink-0 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900">Details</span>
              </div>
              <p className="mt-3 break-words text-base font-bold leading-snug text-slate-900 line-clamp-2 sm:text-lg">
                {parseEigenesMenueFromCustomerName(o.customer_name).cleanName}
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-slate-700">{formatMoney(o.total_amount)}</p>
              <p className="mt-2 line-clamp-3 break-words text-sm leading-relaxed text-slate-600 sm:line-clamp-2">
                {o.short_summary || o.items_summary || "—"}
              </p>
              <p className="mt-3 text-xs font-medium text-slate-400 sm:mt-4">Tippen für alle Positionen</p>
            </button>
          </li>
        ))}
      </ul>

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
                              {menuLines.length > 0 ? (
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
              <button
                type="button"
                onClick={() => deliver(detailOrder.id)}
                className="min-h-12 w-full rounded-2xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-md hover:bg-emerald-700 active:bg-emerald-800"
              >
                Als ausgeliefert markieren
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
