"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CardImageMedia, CardImageMediaThumb } from "@/components/CardImageMedia";
import EigenesMenueModal from "@/components/EigenesMenueModal";
import QuantityPicker from "@/components/QuantityPicker";
import OrderSuccessModal from "@/components/OrderSuccessModal";
import {
  EIGENES_GETRAENKE,
  EIGENES_MARMELADE,
  EIGENES_PREIS_MARMELADE,
  eigenesGetraenkPreis,
  summeEigenesMenueZusatzEntry
} from "@/lib/eigenes-menue";
import { groupProductsForOrderPage } from "@/lib/order-page-product-groups";
import { formatMoney } from "@/lib/format-money";

export default function OrderClient({ products, menus, loadError }) {
  const [name, setName] = useState("");
  const nameInputRef = useRef(null);
  const [productQty, setProductQty] = useState({});
  const [menuQty, setMenuQty] = useState({});
  const [eigenesMenueZusatz, setEigenesMenueZusatz] = useState([]);
  const [eigenesModalOpen, setEigenesModalOpen] = useState(false);
  const [banner, setBanner] = useState("");
  const [nameError, setNameError] = useState("");
  const [nameFieldPulse, setNameFieldPulse] = useState(false);
  const [outsideTimeModalOpen, setOutsideTimeModalOpen] = useState(false);
  const [success, setSuccess] = useState({ open: false, customerName: "", orderNumber: null });
  const [sending, setSending] = useState(false);
  const [cartPreviewOpen, setCartPreviewOpen] = useState(false);

  const eigenesZusatzSumme = useMemo(
    () => eigenesMenueZusatz.reduce((a, z) => a + summeEigenesMenueZusatzEntry(z), 0),
    [eigenesMenueZusatz]
  );

  const { backwaren, heissgetraenke, marmeladeExtras } = useMemo(
    () => groupProductsForOrderPage(products),
    [products]
  );

  const total = useMemo(() => {
    let sum = 0;
    for (const p of products) sum += Number(p.price || 0) * Number(productQty[String(p.id)] || 0);
    for (const m of menus) sum += Number(m.price || 0) * Number(menuQty[String(m.id)] || 0);
    return Math.round((sum + eigenesZusatzSumme) * 100) / 100;
  }, [products, menus, productQty, menuQty, eigenesZusatzSumme]);

  const hasCartLines = useMemo(() => {
    for (const p of products) {
      if (Number(productQty[String(p.id)] || 0) > 0) return true;
    }
    for (const m of menus) {
      if (Number(menuQty[String(m.id)] || 0) > 0) return true;
    }
    if (eigenesMenueZusatz.length > 0) return true;
    return false;
  }, [products, menus, productQty, menuQty, eigenesMenueZusatz]);

  useEffect(() => {
    if (!hasCartLines && cartPreviewOpen) setCartPreviewOpen(false);
  }, [hasCartLines, cartPreviewOpen]);

  const cartPreviewRows = useMemo(() => {
    const rows = [];
    for (const p of products) {
      const q = Number(productQty[String(p.id)] || 0);
      if (q <= 0) continue;
      const unit = Number(p.price || 0);
      rows.push({
        key: `p-${p.id}`,
        icon: "🥐",
        badge: "Backware",
        title: p.name,
        qty: q,
        unit,
        line: Math.round(q * unit * 100) / 100
      });
    }
    for (const m of menus) {
      const q = Number(menuQty[String(m.id)] || 0);
      if (q <= 0) continue;
      const unit = Number(m.price || 0);
      rows.push({
        key: `m-${m.id}`,
        icon: "📋",
        badge: "Menü",
        title: m.name,
        qty: q,
        unit,
        line: Math.round(q * unit * 100) / 100
      });
    }
    eigenesMenueZusatz.forEach((z, idx) => {
      rows.push({
        key: `em-head-${idx}`,
        header: true,
        title: eigenesMenueZusatz.length > 1 ? `Eigenes Menü (${idx + 1})` : "Eigenes Menü (Zusatz)"
      });
      for (const [k, raw] of Object.entries(z.marmelade || {})) {
        const n = Number(raw || 0);
        if (n <= 0) continue;
        const unit = Number(EIGENES_PREIS_MARMELADE[k] || 0);
        const def = EIGENES_MARMELADE.find((x) => x.key === k);
        rows.push({
          key: `em-j-${idx}-${k}`,
          icon: def?.icon || "🍯",
          badge: "Marmelade",
          title: def?.label || k,
          qty: n,
          unit,
          line: Math.round(n * unit * 100) / 100
        });
      }
      const d = EIGENES_GETRAENKE.find((x) => x.key === z.getraenk);
      const gu = eigenesGetraenkPreis(z.getraenk);
      rows.push({
        key: `em-d-${idx}`,
        icon: d?.icon || "☕",
        badge: "Getränk",
        title: d?.label || z.getraenk,
        qty: 1,
        unit: gu,
        line: gu
      });
    });
    return rows;
  }, [products, menus, productQty, menuQty, eigenesMenueZusatz]);

  function formatEigenesCartLine(z, idx) {
    const jamParts = Object.entries(z.marmelade || {})
      .filter(([, q]) => Number(q) > 0)
      .map(([k, q]) => {
        const lab = EIGENES_MARMELADE.find((x) => x.key === k)?.label || k;
        return `${q}× ${lab}`;
      })
      .join(", ");
    const dLab = EIGENES_GETRAENKE.find((x) => x.key === z.getraenk)?.label || z.getraenk;
    return { key: `em-${idx}`, jamParts, dLab, sub: summeEigenesMenueZusatzEntry(z) };
  }

  async function submit() {
    setBanner("");
    setOutsideTimeModalOpen(false);
    if (!name.trim()) {
      setNameError("Bitte geben Sie Ihren Namen ein.");
      setNameFieldPulse(true);
      const input = nameInputRef.current;
      if (input) {
        input.scrollIntoView({ behavior: "smooth", block: "center" });
        window.setTimeout(() => input.focus(), 180);
      }
      return;
    }
    setNameError("");
    setSending(true);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: name.trim(),
        productQuantities: productQty,
        menuQuantities: menuQty,
        eigenesMenueZusatz: eigenesMenueZusatz.length > 0 ? eigenesMenueZusatz : undefined,
        source: "qr"
      })
    });
    const data = await res.json();
    setSending(false);
    if (!res.ok) {
      const msg = String(data.error || "Bestellung fehlgeschlagen.");
      if (/08:00.*21:00/.test(msg)) {
        setOutsideTimeModalOpen(true);
        return;
      }
      setBanner(msg);
      return;
    }
    setSuccess({ open: true, customerName: name.trim(), orderNumber: data.orderNumber });
    setCartPreviewOpen(false);
    setName("");
    setProductQty({});
    setMenuQty({});
    setEigenesMenueZusatz([]);
  }

  useEffect(() => {
    if (!nameFieldPulse) return;
    const t = window.setTimeout(() => setNameFieldPulse(false), 700);
    return () => window.clearTimeout(t);
  }, [nameFieldPulse]);

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="rounded-3xl bg-gradient-to-br from-amber-600 via-orange-500 to-rose-500 p-5 text-white shadow-xl sm:p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-white/70">Morgen früh startklar</p>
        <h1 className="mt-2 text-xl font-bold leading-tight sm:text-2xl">Frühstück vorbestellen</h1>
        <div className="mt-3 rounded-2xl border border-white/25 bg-white/10 px-3 py-3 backdrop-blur-sm sm:mt-4 sm:px-4">
          <p className="text-sm font-semibold tracking-tight sm:text-base">Brötchenbestellungsformular</p>
          <p className="mt-2 text-sm leading-relaxed text-white/95">
            Bestellung ist von 08:00 bis 21:00 Uhr möglich.
          </p>
        </div>
        <p className="mt-3 text-sm leading-snug text-white/90 sm:mt-4">Bestellung ist von 08:00 bis 21:00 Uhr möglich. · Abholung am nächsten Tag</p>
      </section>
      {loadError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm leading-relaxed text-red-800 break-words">
          <p className="font-semibold">Katalog konnte nicht geladen werden</p>
          <p className="mt-1 opacity-95">{loadError}</p>
        </div>
      ) : null}
      {banner ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm leading-relaxed text-red-800 break-words" role="alert">
          {banner}
        </div>
      ) : null}
      <input
        ref={nameInputRef}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (nameError) setNameError("");
        }}
        placeholder="Vor- und Nachname"
        autoComplete="name"
        aria-invalid={nameError ? "true" : "false"}
        aria-describedby={nameError ? "order-name-error" : undefined}
        className={`w-full min-h-12 rounded-2xl border bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none ring-slate-300/0 transition focus:ring-2 ${
          nameError
            ? "border-red-300 focus:border-red-400 focus:ring-red-200/60"
            : "border-slate-200 focus:border-amber-400 focus:ring-amber-200/60"
        } ${nameFieldPulse ? "animate-pulse" : ""}`}
      />
      {nameError ? (
        <p id="order-name-error" className="mt-1 text-sm font-medium text-red-700" role="alert">
          {nameError}
        </p>
      ) : null}

      <div className="rounded-3xl bg-white p-3 ring-1 ring-slate-200 sm:p-4">
        <button
          type="button"
          onClick={() => setEigenesModalOpen(true)}
          className="min-h-12 w-full rounded-2xl border-2 border-dashed border-amber-300/90 bg-gradient-to-r from-amber-50/80 to-orange-50/60 px-3 py-3.5 text-sm font-bold text-amber-950 shadow-sm transition hover:border-amber-400 hover:from-amber-50 hover:to-orange-50 active:scale-[0.99]"
        >
          Eigenes Menü erstellen
        </button>
      </div>

      {eigenesMenueZusatz.length > 0 ? (
        <section className="space-y-2 scroll-mt-24">
          <h2 className="text-lg font-bold">Eigenes Menü (Zusatz)</h2>
          <p className="text-xs leading-relaxed text-slate-600">
            Backwaren dieser Auswahlen sind wie gewohnt bei den Einzelprodukten gezählt; Marmelade und Getränk erscheinen hier.
          </p>
          {eigenesMenueZusatz.map((z, idx) => {
            const line = formatEigenesCartLine(z, idx);
            return (
              <div key={line.key} className="rounded-3xl bg-white p-4 ring-1 ring-amber-200/80">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-800/90">Position {idx + 1}</p>
                <p className="mt-1 text-sm text-slate-700">
                  Marmelade: {line.jamParts || "—"}
                  <br />
                  Getränk: {line.dLab}
                </p>
                <p className="mt-2 font-semibold text-amber-900">Zusatz: {formatMoney(line.sub)}</p>
              </div>
            );
          })}
        </section>
      ) : null}

      <EigenesMenueModal
        open={eigenesModalOpen}
        onClose={() => setEigenesModalOpen(false)}
        products={products}
        onAddToCart={({ breadDeltas, zusatz }) => {
          setProductQty((s) => {
            const next = { ...s };
            for (const [id, q] of Object.entries(breadDeltas)) {
              next[id] = Number(next[id] || 0) + Number(q);
            }
            return next;
          });
          setEigenesMenueZusatz((prev) => [...prev, zusatz]);
        }}
      />

      {menus.length > 0 ? (
      <section className="space-y-3 scroll-mt-24">
        <h2 className="text-lg font-bold">Menüs</h2>
        {menus.map((m) => (
          <div key={m.id} className="rounded-3xl bg-white p-3 ring-1 ring-slate-200 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
              <div className="mx-auto shrink-0 sm:mx-0">
                <CardImageMediaThumb src={m.image_url} alt={m.name} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="break-words font-bold leading-snug">{m.name}</p>
                <p className="mt-1 break-words text-sm leading-relaxed text-slate-600">{m.description || "—"}</p>
                <p className="mt-2 font-semibold text-amber-700">{formatMoney(m.price)}</p>
                <div className="mt-3 flex justify-end sm:mt-4">
                  <QuantityPicker
                    size="compact"
                    value={Number(menuQty[String(m.id)] || 0)}
                    onChange={(v) => setMenuQty((s) => ({ ...s, [String(m.id)]: v }))}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </section>
      ) : null}

      {products.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 text-center ring-1 ring-slate-200">
          <p className="font-semibold text-slate-800">Keine Produkte verfügbar</p>
          <p className="mt-1 text-sm text-slate-500">Bitte später erneut versuchen oder die Verwaltung informieren.</p>
        </div>
      ) : (
        <>
          {backwaren.length > 0 ? (
            <section className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold">Backwaren</h2>
              <div className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2">
                {backwaren.map((p) => (
                  <div key={p.id} className="flex h-full flex-col rounded-3xl bg-white p-3 ring-1 ring-slate-200">
                    <CardImageMedia src={p.image_url} alt={p.name} variant="orderGrid" />
                    <div className="mt-2 flex items-start justify-between gap-3">
                      <p className="min-w-0 flex-1 break-words font-semibold leading-snug">{p.name}</p>
                      <p className="shrink-0 font-bold tabular-nums">{formatMoney(p.price)}</p>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <QuantityPicker
                        size="compact"
                        value={Number(productQty[String(p.id)] || 0)}
                        onChange={(v) => setProductQty((s) => ({ ...s, [String(p.id)]: v }))}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {heissgetraenke.length > 0 ? (
            <section className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold">Heißgetränke</h2>
              <div className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2">
                {heissgetraenke.map((p) => (
                  <div key={p.id} className="flex h-full flex-col rounded-3xl bg-white p-3 ring-1 ring-slate-200">
                    <CardImageMedia src={p.image_url} alt={p.name} variant="orderGrid" />
                    <div className="mt-2 flex items-start justify-between gap-3">
                      <p className="min-w-0 flex-1 break-words font-semibold leading-snug">{p.name}</p>
                      <p className="shrink-0 font-bold tabular-nums">{formatMoney(p.price)}</p>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <QuantityPicker
                        size="compact"
                        value={Number(productQty[String(p.id)] || 0)}
                        onChange={(v) => setProductQty((s) => ({ ...s, [String(p.id)]: v }))}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {marmeladeExtras.length > 0 ? (
            <section className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold">Marmelade & Extras</h2>
              <div className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2">
                {marmeladeExtras.map((p) => (
                  <div key={p.id} className="flex h-full flex-col rounded-3xl bg-white p-3 ring-1 ring-slate-200">
                    <CardImageMedia src={p.image_url} alt={p.name} variant="orderGrid" />
                    <div className="mt-2 flex items-start justify-between gap-3">
                      <p className="min-w-0 flex-1 break-words font-semibold leading-snug">{p.name}</p>
                      <p className="shrink-0 font-bold tabular-nums">{formatMoney(p.price)}</p>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <QuantityPicker
                        size="compact"
                        value={Number(productQty[String(p.id)] || 0)}
                        onChange={(v) => setProductQty((s) => ({ ...s, [String(p.id)]: v }))}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      {cartPreviewOpen ? (
        <div className="fixed inset-0 z-[35] bg-slate-950/20" onClick={() => setCartPreviewOpen(false)} role="presentation">
          <div
            className="fixed inset-x-0 z-[36] max-h-[min(48dvh,22rem)] overflow-hidden border-t border-slate-200/90 bg-white shadow-[0_-8px_30px_-4px_rgba(0,0,0,0.12)] sm:max-h-[min(52vh,26rem)] bottom-[calc(7.25rem+env(safe-area-inset-bottom,0px))] sm:bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))]"
            role="region"
            aria-label="Warenkorb-Vorschau"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto max-h-[inherit] w-full max-w-4xl overflow-y-auto overscroll-y-contain px-4 pb-4 pt-3 [-webkit-overflow-scrolling:touch]">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Ihr Warenkorb</p>
            {cartPreviewRows.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">Noch keine Artikel ausgewählt.</p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-slate-50/60">
                {cartPreviewRows.map((row) =>
                  row.header ? (
                    <li key={row.key} className="bg-amber-50/90 px-3 py-2 text-xs font-bold uppercase tracking-wide text-amber-900">
                      {row.title}
                    </li>
                  ) : (
                    <li key={row.key} className="flex gap-3 px-3 py-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-base ring-1 ring-slate-100">{row.icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase text-amber-800/80">{row.badge}</p>
                        <p className="text-sm font-semibold text-slate-900">{row.title}</p>
                        <p className="text-xs text-slate-600">
                          {row.qty} × {formatMoney(row.unit)}
                          <span className="font-medium text-slate-800"> · {formatMoney(row.line)}</span>
                        </p>
                      </div>
                    </li>
                  )
                )}
              </ul>
            )}
            <p className="mt-3 text-right text-sm font-bold text-slate-900">Gesamt: {formatMoney(total)}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="fixed bottom-0 left-0 right-0 z-[40] border-t border-slate-200/80 bg-white/95 px-4 pt-3 backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
          <div className="flex min-h-11 items-center justify-between gap-3 sm:min-w-0 sm:justify-start">
            <p className="text-sm font-semibold tabular-nums sm:text-base">
              Gesamt: {formatMoney(total)}
            </p>
            {hasCartLines ? (
              <button
                type="button"
                onClick={() => setCartPreviewOpen((v) => !v)}
                className="min-h-11 shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm ring-1 ring-slate-100 active:bg-slate-50 sm:min-h-0 sm:py-1.5"
              >
                <>
                  <span className="sm:hidden">{cartPreviewOpen ? "Ausblenden" : "Warenkorb"}</span>
                  <span className="hidden sm:inline">{cartPreviewOpen ? "Produkte ausblenden" : "Produkte anzeigen"}</span>
                </>
              </button>
            ) : null}
          </div>
          <button
            disabled={sending}
            onClick={submit}
            className="min-h-12 w-full shrink-0 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 px-5 py-3.5 text-sm font-bold text-white shadow-md active:brightness-95 disabled:opacity-60 sm:min-h-11 sm:w-auto sm:py-3"
          >
            {sending ? "Senden…" : "Jetzt bestellen"}
          </button>
        </div>
      </div>

      <OrderSuccessModal
        open={success.open}
        customerName={success.customerName}
        orderNumber={success.orderNumber}
        onClose={() => setSuccess((s) => ({ ...s, open: false }))}
      />
      {outsideTimeModalOpen ? (
        <div
          className="fixed inset-0 z-[95] flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4"
          onClick={() => setOutsideTimeModalOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 className="text-lg font-bold text-slate-900">Bestellung aktuell nicht möglich</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              Bestellungen sind nur zwischen 08:00 und 21:00 Uhr möglich.
            </p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setOutsideTimeModalOpen(false)}
                className="min-h-11 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white sm:min-h-0 sm:py-2"
              >
                Verstanden
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
