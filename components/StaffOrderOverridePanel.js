"use client";

import { useEffect, useMemo, useState } from "react";
import QuantityPicker from "@/components/QuantityPicker";
import { formatMoney } from "@/lib/format-money";

function linesFromOrder(order) {
  return (order?.order_items || [])
    .map((i, idx) => {
      const productId = i.product_id != null ? Number(i.product_id) : i.products?.id != null ? Number(i.products.id) : null;
      const menuId = i.menu_id != null ? Number(i.menu_id) : i.menus?.id != null ? Number(i.menus.id) : null;
      const label = i.products?.name || i.menus?.name || "—";
      if (!productId && !menuId) return null;
      const key = productId ? `p-${productId}` : `m-${menuId}`;
      return {
        key,
        productId: productId || null,
        menuId: menuId || null,
        label,
        isMenu: Boolean(menuId),
        unitPrice: Number(i.unit_price || 0),
        quantity: Math.max(0, Number(i.quantity || 0))
      };
    })
    .filter(Boolean);
}

/**
 * Hidden staff corrections: PIN gate, then payment / undeliver / edit items.
 */
export default function StaffOrderOverridePanel({
  open,
  order,
  apiPrefix,
  catalog,
  unlocked,
  onUnlocked,
  onClose,
  onSuccess
}) {
  const [phase, setPhase] = useState("pin");
  const [pin, setPin] = useState("");
  const [pinErr, setPinErr] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [actionErr, setActionErr] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [editLines, setEditLines] = useState([]);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmPayment, setConfirmPayment] = useState(null);

  const paid = Boolean(order?.paid_at);
  const isDelivered = order?.status === "delivered";
  const isPending = order?.status === "pending";

  useEffect(() => {
    if (!open || !order) return;
    setPin("");
    setPinErr("");
    setActionErr("");
    setActionLoading(false);
    setEditOpen(false);
    setConfirmPayment(null);
    setEditLines(linesFromOrder(order));
    setPhase(unlocked ? "menu" : "pin");
  }, [open, order, unlocked]);

  const editTotal = useMemo(
    () => Math.round(editLines.reduce((s, l) => s + l.quantity * l.unitPrice, 0) * 100) / 100,
    [editLines]
  );

  const catalogExtras = useMemo(() => {
    const existing = new Set(editLines.map((l) => l.key));
    const rows = [];
    for (const p of catalog?.products || []) {
      const key = `p-${p.id}`;
      if (existing.has(key)) continue;
      rows.push({
        key,
        productId: Number(p.id),
        menuId: null,
        label: p.name,
        isMenu: false,
        unitPrice: Number(p.price || 0),
        quantity: 0
      });
    }
    for (const m of catalog?.menus || []) {
      const key = `m-${m.id}`;
      if (existing.has(key)) continue;
      rows.push({
        key,
        productId: null,
        menuId: Number(m.id),
        label: m.name,
        isMenu: true,
        unitPrice: Number(m.price || 0),
        quantity: 0
      });
    }
    return rows.sort((a, b) => a.label.localeCompare(b.label, "de"));
  }, [catalog, editLines]);

  if (!open || !order) return null;

  async function verifyPin(e) {
    e?.preventDefault();
    setPinErr("");
    setPinLoading(true);
    try {
      const res = await fetch(`${apiPrefix}/override/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pin })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "PIN ungültig.");
      onUnlocked?.();
      setPhase("menu");
    } catch (err) {
      setPinErr(String(err.message || err));
    } finally {
      setPinLoading(false);
    }
  }

  async function setPayment(nextPaid) {
    setActionErr("");
    setActionLoading(true);
    try {
      const res = await fetch(`${apiPrefix}/orders/${order.id}/payment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ paid: nextPaid })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Zahlung konnte nicht geändert werden.");
      setConfirmPayment(null);
      onSuccess?.();
      onClose();
    } catch (err) {
      setActionErr(String(err.message || err));
    } finally {
      setActionLoading(false);
    }
  }

  async function undeliver() {
    if (!window.confirm("Auslieferung wirklich rückgängig machen?")) return;
    setActionErr("");
    setActionLoading(true);
    try {
      const res = await fetch(`${apiPrefix}/orders/${order.id}/undeliver`, {
        method: "PATCH",
        credentials: "include"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rückgängig fehlgeschlagen.");
      onSuccess?.();
      onClose();
    } catch (err) {
      setActionErr(String(err.message || err));
    } finally {
      setActionLoading(false);
    }
  }

  function setLineQty(key, qty) {
    setEditLines((prev) => prev.map((l) => (l.key === key ? { ...l, quantity: qty } : l)));
  }

  function addCatalogLine(row, qty) {
    if (qty <= 0) return;
    setEditLines((prev) => [...prev, { ...row, quantity: qty }]);
  }

  async function saveItems() {
    const active = editLines.filter((l) => l.quantity > 0);
    if (active.length === 0) {
      setActionErr("Mindestens ein Artikel mit Menge > 0.");
      return;
    }
    if (!window.confirm("Bestellung wirklich ändern?")) return;
    setActionErr("");
    setActionLoading(true);
    try {
      const res = await fetch(`${apiPrefix}/orders/${order.id}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          lines: active.map((l) => ({
            productId: l.productId,
            menuId: l.menuId,
            quantity: l.quantity
          }))
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Speichern fehlgeschlagen.");
      onSuccess?.();
      onClose();
    } catch (err) {
      setActionErr(String(err.message || err));
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center bg-slate-950/65 p-0 sm:items-center sm:p-4"
      onClick={() => !actionLoading && !confirmPayment && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="staff-override-title"
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="staff-override-title" className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
          Korrektur
        </p>
        <p className="mt-1 text-lg font-bold text-slate-900">
          Bestellung #{order.order_number}
        </p>

        {phase === "pin" ? (
          <form onSubmit={verifyPin} className="mt-4 space-y-3">
            <p className="text-sm text-slate-600">PIN eingeben (nur für Korrekturen).</p>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              maxLength={8}
              className="min-h-12 w-full rounded-xl border border-slate-200 px-4 text-center text-2xl font-bold tracking-[0.3em] text-slate-900"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              disabled={pinLoading}
            />
            {pinErr ? <p className="text-sm text-red-700">{pinErr}</p> : null}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={onClose} className="min-h-11 rounded-xl text-sm font-semibold text-slate-600">
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={pinLoading || pin.length < 4}
                className="min-h-11 rounded-xl bg-slate-800 text-sm font-bold text-white disabled:opacity-50"
              >
                {pinLoading ? "…" : "Freischalten"}
              </button>
            </div>
          </form>
        ) : null}

        {phase === "menu" && !editOpen ? (
          <div className="mt-4 space-y-2">
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => setConfirmPayment({ paid: !paid })}
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-left text-sm font-bold text-slate-900 hover:bg-slate-50"
            >
              {paid ? "Zahlung zurücksetzen (offen)" : "Als bezahlt markieren"}
            </button>
            {isDelivered ? (
              <button
                type="button"
                disabled={actionLoading}
                onClick={undeliver}
                className="min-h-12 w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 text-left text-sm font-bold text-amber-950 hover:bg-amber-100"
              >
                Auslieferung rückgängig
              </button>
            ) : null}
            {isPending ? (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setEditOpen(true)}
                className="min-h-12 w-full rounded-2xl border border-brand-green/30 bg-brand-green/10 px-4 text-left text-sm font-bold text-brand-green hover:bg-brand-green/15"
              >
                Artikel bearbeiten
              </button>
            ) : null}
            {actionErr ? <p className="text-sm text-red-700">{actionErr}</p> : null}
            <button type="button" onClick={onClose} className="min-h-11 w-full text-sm font-semibold text-slate-500">
              Schließen
            </button>
          </div>
        ) : null}

        {phase === "menu" && editOpen ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm font-semibold text-slate-800">Positionen anpassen</p>
            <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-100">
              {editLines.map((line) => (
                <li key={line.key} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{line.label}</p>
                    <p className="text-xs text-slate-500">{formatMoney(line.unitPrice)}</p>
                  </div>
                  <QuantityPicker
                    size="compact"
                    value={line.quantity}
                    max={10}
                    disabled={actionLoading}
                    onChange={(n) => setLineQty(line.key, n)}
                  />
                </li>
              ))}
            </ul>
            {catalogExtras.length > 0 ? (
              <div>
                <p className="text-xs font-bold uppercase text-slate-400">Hinzufügen</p>
                <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto">
                  {catalogExtras.slice(0, 12).map((row) => (
                    <li key={row.key} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate">{row.label}</span>
                      <QuantityPicker
                        size="compact"
                        value={row.quantity}
                        max={10}
                        disabled={actionLoading}
                        onChange={(n) => {
                          if (n > 0) addCatalogLine(row, n);
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="flex items-center justify-between rounded-xl bg-slate-900 px-3 py-2 text-white">
              <span className="text-sm">Neue Summe</span>
              <span className="font-bold">{formatMoney(editTotal)}</span>
            </div>
            {actionErr ? <p className="text-sm text-red-700">{actionErr}</p> : null}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setEditOpen(false)} className="min-h-11 rounded-xl text-sm font-semibold text-slate-600">
                Zurück
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={saveItems}
                className="min-h-11 rounded-xl bg-brand-green text-sm font-bold text-white disabled:opacity-50"
              >
                {actionLoading ? "…" : "Speichern"}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {confirmPayment ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4"
          onClick={() => !actionLoading && setConfirmPayment(null)}
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-payment-title"
          >
            <h3 id="confirm-payment-title" className="text-lg font-bold text-slate-900">
              {confirmPayment.paid ? "Als bezahlt markieren?" : "Zahlung zurücksetzen?"}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {confirmPayment.paid
                ? "Die Bestellung wird als vorab bezahlt markiert."
                : "Die Zahlung wird wieder als offen gesetzt."}
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setConfirmPayment(null)}
                className="min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:min-h-0 sm:py-2"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setPayment(confirmPayment.paid)}
                className="min-h-11 rounded-xl bg-brand-green px-4 py-2.5 text-sm font-bold text-white hover:brightness-95 disabled:opacity-50 sm:min-h-0 sm:py-2"
              >
                {actionLoading ? "…" : "Bestätigen"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
