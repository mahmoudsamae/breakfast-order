"use client";

import { useMemo, useState } from "react";
import QuantityPicker from "@/components/QuantityPicker";
import { formatMoney } from "@/lib/format-money";
import {
  EIGENES_BACKWAREN_KEYS,
  EIGENES_GETRAENKE,
  EIGENES_MARMELADE,
  EIGENES_PREIS_GETRAENK,
  EIGENES_PREIS_MARMELADE,
  eigenesGetraenkPreis,
  eigenesMarmeladeSumme,
  summeEigenesMenueZusatzEntry
} from "@/lib/eigenes-menue";

function initQtyMap(keys) {
  return Object.fromEntries(keys.map((k) => [k, 0]));
}

export default function EigenesMenueModal({ open, onClose, products, onAddToCart }) {
  const [back, setBack] = useState(() => initQtyMap(EIGENES_BACKWAREN_KEYS.map((x) => x.key)));
  const [jam, setJam] = useState(() => initQtyMap(EIGENES_MARMELADE.map((x) => x.key)));
  const [drink, setDrink] = useState(null);

  const productIdByName = useMemo(() => {
    const m = {};
    for (const p of products || []) {
      if (p?.name) m[p.name] = p.id;
    }
    return m;
  }, [products]);

  const breadCatalogOk = useMemo(
    () => EIGENES_BACKWAREN_KEYS.every((row) => productIdByName[row.productName] != null),
    [productIdByName]
  );

  const backSum = useMemo(() => Object.values(back).reduce((a, v) => a + Number(v || 0), 0), [back]);
  const jamMeta = useMemo(() => eigenesMarmeladeSumme(jam), [jam]);
  const drinkPrice = drink ? eigenesGetraenkPreis(drink) : 0;

  const breadPrices = useMemo(() => {
    let s = 0;
    for (const row of EIGENES_BACKWAREN_KEYS) {
      const id = productIdByName[row.productName];
      const p = products?.find((x) => x.id === id);
      const unit = Number(p?.price || 0);
      s += unit * Number(back[row.key] || 0);
    }
    return Math.round(s * 100) / 100;
  }, [back, productIdByName, products]);

  const zusatzPreis = useMemo(() => summeEigenesMenueZusatzEntry({ marmelade: jam, getraenk: drink }), [jam, drink]);

  const previewTotal = useMemo(() => Math.round((breadPrices + zusatzPreis) * 100) / 100, [breadPrices, zusatzPreis]);

  const canSubmit =
    breadCatalogOk &&
    backSum === 2 &&
    jamMeta.qty >= 1 &&
    jamMeta.qty <= 2 &&
    Boolean(drink) &&
    drinkPrice > 0;

  function resetAndClose() {
    setBack(initQtyMap(EIGENES_BACKWAREN_KEYS.map((x) => x.key)));
    setJam(initQtyMap(EIGENES_MARMELADE.map((x) => x.key)));
    setDrink(null);
    onClose();
  }

  function handleAdd() {
    if (!canSubmit) return;
    const breadDeltas = {};
    let missing = false;
    for (const row of EIGENES_BACKWAREN_KEYS) {
      const q = Number(back[row.key] || 0);
      if (!q) continue;
      const id = productIdByName[row.productName];
      if (id == null) {
        missing = true;
        break;
      }
      breadDeltas[String(id)] = q;
    }
    if (missing || Object.keys(breadDeltas).length === 0) return;
    onAddToCart({
      breadDeltas,
      zusatz: { marmelade: { ...jam }, getraenk: drink }
    });
    setBack(initQtyMap(EIGENES_BACKWAREN_KEYS.map((x) => x.key)));
    setJam(initQtyMap(EIGENES_MARMELADE.map((x) => x.key)));
    setDrink(null);
    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[85] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={resetAndClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="eigenes-menue-title"
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto overscroll-y-contain rounded-t-3xl bg-white shadow-2xl sm:max-h-[90dvh] sm:rounded-3xl [-webkit-overflow-scrolling:touch]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] backdrop-blur-sm sm:px-5 sm:py-4">
          <div className="flex items-start justify-between gap-3">
            <h2 id="eigenes-menue-title" className="pr-2 text-lg font-bold leading-snug text-slate-900 sm:text-xl">
              Eigenes Frühstück zusammenstellen
            </h2>
            <button
              type="button"
              onClick={resetAndClose}
              className="min-h-10 min-w-10 shrink-0 rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 active:bg-slate-200 sm:min-h-0 sm:min-w-0 sm:py-1.5"
            >
              Schließen
            </button>
          </div>
        </div>

        <div className="space-y-6 px-4 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom,0px)+1rem)] sm:px-5 sm:py-5">
          <section>
            <h3 className="text-sm font-bold text-slate-900">Backwaren (2 Stück wählen)</h3>
            <p className="mt-1 text-xs text-slate-500">Insgesamt genau 2 Stück; dieselbe Sorte ist erlaubt.</p>
            {!breadCatalogOk ? (
              <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800 ring-1 ring-red-100">
                Die vier Standard-Backwaren sind im Katalog nicht vollständig. Bitte später erneut versuchen.
              </p>
            ) : null}
            <div className="mt-3 space-y-2">
              {EIGENES_BACKWAREN_KEYS.map((row) => {
                const id = productIdByName[row.productName];
                const p = products?.find((x) => x.id === id);
                const unit = p ? formatMoney(p.price) : "—";
                return (
                  <div
                    key={row.key}
                    className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${backSum === 2 && Number(back[row.key]) > 0 ? "border-amber-300 bg-amber-50/50" : "border-slate-200 bg-white"}`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-xl">{row.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">{row.label}</p>
                      <p className="text-xs text-slate-500">{unit} · Stück</p>
                    </div>
                    <QuantityPicker
                      size="compact"
                      value={Number(back[row.key] || 0)}
                      max={2}
                      onChange={(v) => {
                        setBack((s) => {
                          const next = { ...s, [row.key]: v };
                          const sum = Object.values(next).reduce((a, x) => a + Number(x || 0), 0);
                          if (sum > 2) return s;
                          return next;
                        });
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <p className={`mt-2 text-xs font-medium ${backSum === 2 ? "text-emerald-700" : "text-amber-800"}`}>
              Gewählt: {backSum} / 2
            </p>
          </section>

          <section>
            <h3 className="text-sm font-bold text-slate-900">Marmelade (1–2 wählen)</h3>
            <p className="mt-1 text-xs text-slate-500">Mindestens 1, höchstens 2 Portionen verteilt auf die Sorten.</p>
            <div className="mt-3 space-y-2">
              {EIGENES_MARMELADE.map((row) => (
                <div
                  key={row.key}
                  className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${jamMeta.qty >= 1 && Number(jam[row.key]) > 0 ? "border-amber-300 bg-amber-50/50" : "border-slate-200 bg-white"}`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-xl">{row.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{row.label}</p>
                    <p className="text-xs text-slate-500">{formatMoney(EIGENES_PREIS_MARMELADE[row.key] ?? 0)} pro Portion</p>
                  </div>
                  <QuantityPicker
                    size="compact"
                    value={Number(jam[row.key] || 0)}
                    max={2}
                    onChange={(v) => {
                      setJam((s) => {
                        const next = { ...s, [row.key]: v };
                        const sum = Object.values(next).reduce((a, x) => a + Number(x || 0), 0);
                        if (sum > 2) return s;
                        return next;
                      });
                    }}
                  />
                </div>
              ))}
            </div>
            <p className={`mt-2 text-xs font-medium ${jamMeta.qty >= 1 && jamMeta.qty <= 2 ? "text-emerald-700" : "text-amber-800"}`}>
              Portionen: {jamMeta.qty} (Ziel: 1–2)
            </p>
          </section>

          <section>
            <h3 className="text-sm font-bold text-slate-900">Getränk (1 wählen)</h3>
            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-2">
              {EIGENES_GETRAENKE.map((row) => {
                const sel = drink === row.key;
                return (
                  <button
                    key={row.key}
                    type="button"
                    onClick={() => setDrink(row.key)}
                    className={`min-h-[3.25rem] rounded-2xl border px-3 py-3 text-left text-sm font-semibold leading-snug transition active:scale-[0.98] ${
                      sel ? "border-amber-500 bg-amber-50 ring-2 ring-amber-400" : "border-slate-200 bg-white hover:border-amber-200"
                    }`}
                  >
                    <span className="mr-1.5">{row.icon}</span>
                    {row.label}
                    <span className="mt-1 block text-xs font-normal text-slate-600">{formatMoney(EIGENES_PREIS_GETRAENK[row.key] ?? 0)}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <p className="font-semibold text-slate-800">Vorschau Dieses Menü</p>
            <p className="mt-1 text-slate-600">
              Backwaren: {formatMoney(breadPrices)} · Zusatz Marmelade/Getränk: {formatMoney(zusatzPreis)}
            </p>
            <p className="mt-2 text-base font-bold text-amber-900">Zwischensumme: {formatMoney(previewTotal)}</p>
          </div>

          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleAdd}
            className="min-h-12 w-full rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 py-3.5 text-sm font-bold text-white shadow-md active:brightness-95 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Zum Warenkorb hinzufügen
          </button>
        </div>
      </div>
    </div>
  );
}
