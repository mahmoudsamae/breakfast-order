"use client";

import { useEffect, useMemo, useState } from "react";
import QuantityPicker from "@/components/QuantityPicker";
import { parseEigenesMenueFromCustomerName } from "@/lib/eigenes-menue";
import { formatMoney } from "@/lib/format-money";

function linesFromOrder(order) {
  return (order?.order_items || [])
    .map((i) => {
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
 * Hidden staff corrections: PIN gate, then payment / undeliver / edit items / rename / delete.
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
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [confirmPayment, setConfirmPayment] = useState(null);
  const [confirmUndeliver, setConfirmUndeliver] = useState(false);
  const [confirmReopenNoshow, setConfirmReopenNoshow] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const paid = Boolean(order?.paid_at);
  const isDelivered = order?.status === "delivered";
  const isNotPickedUp = order?.status === "not_picked_up";
  const isPending = order?.status === "pending";
  const displayName = order ? parseEigenesMenueFromCustomerName(order.customer_name).cleanName : "";
  const blockingConfirm = Boolean(confirmPayment || confirmUndeliver || confirmReopenNoshow || confirmDelete);

  useEffect(() => {
    if (!open || !order) return;
    setPin("");
    setPinErr("");
    setActionErr("");
    setActionLoading(false);
    setEditOpen(false);
    setRenameOpen(false);
    setRenameValue(parseEigenesMenueFromCustomerName(order.customer_name).cleanName);
    setConfirmPayment(null);
    setConfirmUndeliver(false);
    setConfirmReopenNoshow(false);
    setConfirmDelete(false);
    setDeleteConfirmText("");
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
      onSuccess?.({ kind: "payment" });
      onClose();
    } catch (err) {
      setActionErr(String(err.message || err));
    } finally {
      setActionLoading(false);
    }
  }

  async function undeliver() {
    setActionErr("");
    setActionLoading(true);
    try {
      const res = await fetch(`${apiPrefix}/orders/${order.id}/undeliver`, {
        method: "PATCH",
        credentials: "include"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rückgängig fehlgeschlagen.");
      setConfirmUndeliver(false);
      onSuccess?.({ kind: "undeliver" });
      onClose();
    } catch (err) {
      setActionErr(String(err.message || err));
    } finally {
      setActionLoading(false);
    }
  }

  async function reopenNoshow() {
    setActionErr("");
    setActionLoading(true);
    try {
      const res = await fetch(`${apiPrefix}/orders/${order.id}/reopen`, {
        method: "PATCH",
        credentials: "include"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Wiederöffnen fehlgeschlagen.");
      setConfirmReopenNoshow(false);
      onSuccess?.({ kind: "reopen" });
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
      onSuccess?.({ kind: "items" });
      onClose();
    } catch (err) {
      setActionErr(String(err.message || err));
    } finally {
      setActionLoading(false);
    }
  }

  async function saveName() {
    const next = String(renameValue || "").trim();
    if (!next) {
      setActionErr("Name ist erforderlich.");
      return;
    }
    if (next === displayName) {
      setRenameOpen(false);
      return;
    }
    setActionErr("");
    setActionLoading(true);
    try {
      const res = await fetch(`${apiPrefix}/orders/${order.id}/customer-name`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ customerName: next })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Name konnte nicht geändert werden.");
      setRenameOpen(false);
      onSuccess?.({ kind: "rename" });
      onClose();
    } catch (err) {
      setActionErr(String(err.message || err));
    } finally {
      setActionLoading(false);
    }
  }

  async function hardDeleteOrder() {
    const expected = String(order.order_number ?? "");
    if (deleteConfirmText.trim() !== expected) {
      setActionErr(`Bitte Bestellnummer ${expected} zur Bestätigung eingeben.`);
      return;
    }
    setActionErr("");
    setActionLoading(true);
    try {
      const res = await fetch(`${apiPrefix}/orders/${order.id}`, {
        method: "DELETE",
        credentials: "include"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Löschen fehlgeschlagen.");
      setConfirmDelete(false);
      onSuccess?.({ kind: "delete", deleted: true });
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
      onClick={() => !actionLoading && !blockingConfirm && onClose()}
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

        {phase === "menu" && !editOpen && !renameOpen ? (
          <div className="mt-4 space-y-2">
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => {
                setActionErr("");
                setRenameValue(displayName);
                setRenameOpen(true);
              }}
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-left text-sm font-bold text-slate-900 hover:bg-slate-50"
            >
              Namen ändern
            </button>
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
                onClick={() => setConfirmUndeliver(true)}
                className="min-h-12 w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 text-left text-sm font-bold text-amber-950 hover:bg-amber-100"
              >
                Auslieferung rückgängig
              </button>
            ) : null}
            {isNotPickedUp ? (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setConfirmReopenNoshow(true)}
                className="min-h-12 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 text-left text-sm font-bold text-slate-900 hover:bg-slate-100"
              >
                „Nicht abgeholt“ rückgängig (Offen)
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
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => {
                setActionErr("");
                setDeleteConfirmText("");
                setConfirmDelete(true);
              }}
              className="min-h-12 w-full rounded-2xl border border-red-200 bg-red-50 px-4 text-left text-sm font-bold text-red-800 hover:bg-red-100"
            >
              Bestellung endgültig löschen
            </button>
            {actionErr ? <p className="text-sm text-red-700">{actionErr}</p> : null}
            <button type="button" onClick={onClose} className="min-h-11 w-full text-sm font-semibold text-slate-500">
              Schließen
            </button>
          </div>
        ) : null}

        {phase === "menu" && renameOpen ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm font-semibold text-slate-800">Namen ändern</p>
            <p className="text-xs leading-relaxed text-slate-500">
              Nur der Anzeigename. Eigenes-Menü-Zusatz (falls vorhanden) bleibt erhalten.
            </p>
            <input
              type="text"
              autoComplete="off"
              maxLength={120}
              className="min-h-12 w-full rounded-xl border border-slate-200 px-3 text-base text-slate-900 shadow-sm focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/25"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              disabled={actionLoading}
            />
            {actionErr ? <p className="text-sm text-red-700">{actionErr}</p> : null}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => {
                  setRenameOpen(false);
                  setActionErr("");
                }}
                className="min-h-11 rounded-xl text-sm font-semibold text-slate-600"
              >
                Zurück
              </button>
              <button
                type="button"
                disabled={actionLoading || !String(renameValue || "").trim()}
                onClick={saveName}
                className="min-h-11 rounded-xl bg-brand-green text-sm font-bold text-white disabled:opacity-50"
              >
                {actionLoading ? "…" : "Speichern"}
              </button>
            </div>
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

      {confirmUndeliver ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4"
          onClick={() => !actionLoading && setConfirmUndeliver(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-undeliver-title"
          >
            <h3 id="confirm-undeliver-title" className="text-lg font-bold text-slate-900">
              Auslieferung rückgängig?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Die Bestellung wird wieder als offen (ausstehend) gesetzt – auch bei Vorbestellungen für morgen.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setConfirmUndeliver(false)}
                className="min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:min-h-0 sm:py-2"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={undeliver}
                className="min-h-11 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white hover:brightness-95 disabled:opacity-50 sm:min-h-0 sm:py-2"
              >
                {actionLoading ? "…" : "Bestätigen"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmReopenNoshow ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4"
          onClick={() => !actionLoading && setConfirmReopenNoshow(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-reopen-noshow-title"
          >
            <h3 id="confirm-reopen-noshow-title" className="text-lg font-bold text-slate-900">
              „Nicht abgeholt“ rückgängig?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Die Bestellung wird wieder als offen gesetzt. Grund und Notiz werden gelöscht.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setConfirmReopenNoshow(false)}
                className="min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:min-h-0 sm:py-2"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={reopenNoshow}
                className="min-h-11 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-bold text-white hover:brightness-95 disabled:opacity-50 sm:min-h-0 sm:py-2"
              >
                {actionLoading ? "…" : "Bestätigen"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmDelete ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4"
          onClick={() => {
            if (!actionLoading) {
              setConfirmDelete(false);
              setDeleteConfirmText("");
              setActionErr("");
            }
          }}
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-delete-order-title"
          >
            <h3 id="confirm-delete-order-title" className="text-lg font-bold text-red-800">
              Bestellung endgültig löschen?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Bestellung <span className="font-bold text-slate-900">#{order.order_number}</span>
              {displayName ? (
                <>
                  {" "}
                  ({displayName})
                </>
              ) : null}{" "}
              wird dauerhaft aus der Datenbank entfernt. Das kann nicht rückgängig gemacht werden.
            </p>
            <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Bestellnummer zur Bestätigung eingeben
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className="mt-1.5 min-h-11 w-full rounded-xl border border-red-200 px-3 text-center text-lg font-bold tabular-nums text-slate-900"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value.replace(/\D/g, ""))}
              placeholder={String(order.order_number ?? "")}
              disabled={actionLoading}
            />
            {actionErr ? <p className="mt-2 text-sm text-red-700">{actionErr}</p> : null}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => {
                  setConfirmDelete(false);
                  setDeleteConfirmText("");
                  setActionErr("");
                }}
                className="min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:min-h-0 sm:py-2"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={actionLoading || deleteConfirmText.trim() !== String(order.order_number ?? "")}
                onClick={hardDeleteOrder}
                className="min-h-11 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white hover:brightness-95 disabled:opacity-50 sm:min-h-0 sm:py-2"
              >
                {actionLoading ? "…" : "Endgültig löschen"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
