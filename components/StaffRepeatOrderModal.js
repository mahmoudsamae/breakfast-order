"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parseEigenesMenueFromCustomerName } from "@/lib/eigenes-menue";
import { formatMoney } from "@/lib/format-money";
import { berlinDateWithOffset } from "@/lib/order-utils";
import QuantityPicker from "@/components/QuantityPicker";

function lineKey(productId, menuId) {
  if (productId) return `p-${productId}`;
  if (menuId) return `m-${menuId}`;
  return null;
}

function linesFromOrder(order) {
  return (order?.order_items || [])
    .map((i, idx) => {
      const productId = i.product_id != null ? Number(i.product_id) : i.products?.id != null ? Number(i.products.id) : null;
      const menuId = i.menu_id != null ? Number(i.menu_id) : i.menus?.id != null ? Number(i.menus.id) : null;
      const label = i.products?.name || i.menus?.name || "—";
      const isMenu = Boolean(menuId);
      if (!productId && !menuId) return null;
      return {
        key: lineKey(productId, menuId) || `line-${i.id ?? idx}`,
        productId: productId || null,
        menuId: menuId || null,
        label,
        isMenu,
        unitPrice: Number(i.unit_price || 0),
        quantity: Math.max(0, Number(i.quantity || 0)),
        fromOriginalOrder: true
      };
    })
    .filter(Boolean);
}

export default function StaffRepeatOrderModal({ open, order, apiPrefix, catalog, onClose, onCreated }) {
  const [lines, setLines] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [localErr, setLocalErr] = useState("");
  const [addOpen, setAddOpen] = useState(true);
  const [paidNow, setPaidNow] = useState(false);
  const originalLineKeysRef = useRef(new Set());

  const tomorrowYmd = berlinDateWithOffset(1);
  const tomorrowLabel = useMemo(() => {
    try {
      return new Date(`${tomorrowYmd}T12:00:00`).toLocaleDateString("de-DE", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      });
    } catch {
      return tomorrowYmd;
    }
  }, [tomorrowYmd]);

  const cleanName = useMemo(
    () => (order ? parseEigenesMenueFromCustomerName(order.customer_name).cleanName : ""),
    [order]
  );

  const originalLines = useMemo(
    () => lines.filter((l) => originalLineKeysRef.current.has(l.key)),
    [lines]
  );

  const additionalCatalogRows = useMemo(() => {
    const rows = [];
    for (const p of catalog?.products || []) {
      const key = lineKey(Number(p.id), null);
      if (!key || originalLineKeysRef.current.has(key)) continue;
      const existing = lines.find((l) => l.key === key);
      rows.push({
        key,
        productId: Number(p.id),
        menuId: null,
        label: p.name,
        isMenu: false,
        unitPrice: Number(p.price || 0),
        quantity: existing?.quantity ?? 0
      });
    }
    for (const m of catalog?.menus || []) {
      const key = lineKey(null, Number(m.id));
      if (!key || originalLineKeysRef.current.has(key)) continue;
      const existing = lines.find((l) => l.key === key);
      rows.push({
        key,
        productId: null,
        menuId: Number(m.id),
        label: m.name,
        isMenu: true,
        unitPrice: Number(m.price || 0),
        quantity: existing?.quantity ?? 0
      });
    }
    return rows.sort((a, b) => a.label.localeCompare(b.label, "de"));
  }, [catalog, lines]);

  const total = useMemo(
    () => Math.round(lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0) * 100) / 100,
    [lines]
  );

  useEffect(() => {
    if (!open || !order) return;
    const initial = linesFromOrder(order);
    originalLineKeysRef.current = new Set(initial.map((l) => l.key));
    setLines(initial);
    setLocalErr("");
    setSubmitting(false);
    setAddOpen(true);
    setPaidNow(false);
  }, [open, order]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, submitting, onClose]);

  if (!open || !order) return null;

  function upsertLineQty(key, patch, qty) {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.key === key);
      if (idx >= 0) {
        if (qty <= 0 && !originalLineKeysRef.current.has(key)) {
          return prev.filter((l) => l.key !== key);
        }
        return prev.map((l) => (l.key === key ? { ...l, ...patch, quantity: qty } : l));
      }
      if (qty <= 0) return prev;
      return [...prev, { ...patch, key, quantity: qty, fromOriginalOrder: false }];
    });
  }

  function setOriginalLineQty(key, qty) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, quantity: qty } : l)));
  }

  function setAdditionalQty(row, qty) {
    upsertLineQty(row.key, {
      productId: row.productId,
      menuId: row.menuId,
      label: row.label,
      isMenu: row.isMenu,
      unitPrice: row.unitPrice
    }, qty);
  }

  async function submit() {
    setLocalErr("");
    const active = lines.filter((l) => l.quantity > 0);
    if (active.length === 0) {
      setLocalErr("Bitte mindestens einen Artikel mit Menge größer 0 wählen.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${apiPrefix}/orders/repeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceOrderId: order.id,
          pickupDate: tomorrowYmd,
          paidNow,
          lines: active.map((l) => ({
            productId: l.productId,
            menuId: l.menuId,
            quantity: l.quantity
          }))
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Vorbestellung fehlgeschlagen.");
      onCreated?.(data);
      onClose();
    } catch (e) {
      setLocalErr(String(e.message || e));
    } finally {
      setSubmitting(false);
    }
  }

  const hasCatalog = (catalog?.products?.length || 0) + (catalog?.menus?.length || 0) > 0;

  return (
    <div
      className="fixed inset-0 z-[88] flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4"
      onClick={() => !submitting && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="repeat-order-title"
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto overscroll-y-contain rounded-t-3xl bg-white shadow-2xl sm:max-h-[90dvh] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-4 py-4 backdrop-blur-sm sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p id="repeat-order-title" className="text-lg font-bold text-slate-900">
                Für morgen vorbestellen
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Abholung: <span className="font-semibold text-slate-800">{tomorrowLabel}</span>
              </p>
              <p className="mt-1 break-words text-sm font-medium text-slate-800">{cleanName}</p>
              <p className="text-xs text-slate-500">Basierend auf Bestellung #{order.order_number}</p>
            </div>
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
            >
              Schließen
            </button>
          </div>
        </div>

        <div className="space-y-4 px-4 py-4 sm:px-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Aus dieser Bestellung</p>
            {originalLines.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Keine Positionen zum Übernehmen.</p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-slate-50/50">
                {originalLines.map((line) => (
                  <li key={line.key} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase text-brand-green/90">{line.isMenu ? "Menü" : "Produkt"}</p>
                      <p className="break-words text-sm font-semibold text-slate-900">{line.label}</p>
                      <p className="text-xs text-slate-500">{formatMoney(line.unitPrice)} / Stück</p>
                    </div>
                    <QuantityPicker
                      size="compact"
                      value={line.quantity}
                      max={10}
                      disabled={submitting}
                      onChange={(n) => setOriginalLineQty(line.key, n)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {hasCatalog ? (
            <div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setAddOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-bold text-slate-800"
              >
                <span>Weitere Artikel hinzufügen</span>
                <span className="text-xs font-semibold text-brand-orange">{addOpen ? "▲" : "▼"}</span>
              </button>
              {addOpen ? (
                <div className="mt-2 space-y-3">
                  {additionalCatalogRows.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 px-3 py-2.5 text-sm text-slate-500">
                      Alle Katalog-Artikel sind bereits in der Bestellung enthalten — Mengen oben anpassen.
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-100 rounded-2xl border border-brand-green/15 bg-brand-green/10/30">
                      {additionalCatalogRows.map((row) => (
                        <li key={row.key} className="flex items-center justify-between gap-3 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold uppercase text-brand-green/90">{row.isMenu ? "Menü" : "Produkt"}</p>
                            <p className="break-words text-sm font-semibold text-slate-900">{row.label}</p>
                            <p className="text-xs text-slate-500">{formatMoney(row.unitPrice)} / Stück</p>
                          </div>
                          <QuantityPicker
                            size="compact"
                            value={row.quantity}
                            max={10}
                            disabled={submitting}
                            onChange={(n) => setAdditionalQty(row, n)}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center justify-between rounded-2xl bg-slate-900 px-4 py-3 text-white">
            <span className="text-sm font-medium text-white/80">Neue Summe</span>
            <span className="text-lg font-black">{formatMoney(total)}</span>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Zahlung</p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={submitting}
                className={`min-h-11 rounded-xl px-3 py-2.5 text-sm font-bold transition ${paidNow ? "bg-brand-green text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                onClick={() => setPaidNow(true)}
              >
                Jetzt bezahlt
              </button>
              <button
                type="button"
                disabled={submitting}
                className={`min-h-11 rounded-xl px-3 py-2.5 text-sm font-bold transition ${!paidNow ? "bg-brand-green text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                onClick={() => setPaidNow(false)}
              >
                Bei Abholung zahlen
              </button>
            </div>
          </div>

          {localErr ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">{localErr}</div>
          ) : null}

          <p className="text-xs leading-relaxed text-slate-500">
            Die heutige Bestellung bleibt unverändert. Es wird eine neue Vorbestellung mit neuem Nummernkreis für morgen angelegt.
          </p>
        </div>

        <div className="sticky bottom-0 border-t border-slate-100 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] sm:p-5">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="min-h-11 rounded-2xl px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Abbrechen
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={submit}
              className="min-h-11 rounded-2xl bg-brand-orange px-4 py-2.5 text-sm font-bold text-white hover:brightness-95 disabled:opacity-60"
            >
              {submitting ? "Speichern…" : "Vorbestellung anlegen"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
