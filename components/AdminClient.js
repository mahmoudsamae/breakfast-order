"use client";

import { useCallback, useEffect, useState } from "react";
import { CardImageMedia, CardImageMediaPreview } from "@/components/CardImageMedia";
import { formatMoney } from "@/lib/format-money";
import {
  normalizeProductCategorySlug,
  productCategoryLabelDe,
  PRODUCT_CATEGORY_FORM_OPTIONS
} from "@/lib/product-category";

async function upload(file, folder) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", folder);
  const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload fehlgeschlagen.");
  return data.url;
}

const productFormFieldClass =
  "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200/50 sm:min-h-0 sm:text-sm";

function Hero({ title, subtitle }) {
  return (
    <section className="rounded-3xl bg-gradient-to-br from-amber-600 via-orange-500 to-rose-500 p-5 text-white shadow-xl sm:p-6">
      <p className="text-xs uppercase tracking-[0.2em] text-white/75">Verwaltung</p>
      <h1 className="mt-2 text-xl font-bold leading-tight sm:text-2xl">{title}</h1>
      {subtitle ? <p className="mt-2 text-sm leading-snug text-white/90">{subtitle}</p> : null}
    </section>
  );
}

function Kpi({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/95 p-4 shadow-md ring-1 ring-slate-200/60">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export default function AdminClient() {
  const [tab, setTab] = useState("overview");
  const [summary, setSummary] = useState(null);
  const [products, setProducts] = useState([]);
  const [menus, setMenus] = useState([]);
  const [err, setErr] = useState("");

  const loadAll = useCallback(async () => {
    setErr("");
    try {
      const [s, p, m] = await Promise.all([
        fetch("/api/admin/summary", { cache: "no-store" }),
        fetch("/api/admin/products", { cache: "no-store" }),
        fetch("/api/admin/menus", { cache: "no-store" })
      ]);
      const [sd, pd, md] = await Promise.all([s.json(), p.json(), m.json()]);
      if (!s.ok) throw new Error(sd.error || "Übersicht konnte nicht geladen werden.");
      if (!p.ok) throw new Error(pd.error || "Produkte Fehler");
      if (!m.ok) throw new Error(md.error || "Menüs Fehler");
      setSummary(sd);
      setProducts(pd.products || []);
      setMenus(md.menus || []);
    } catch (e) {
      setErr(String(e.message || e));
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function saveProduct(p) {
    const res = await fetch("/api/admin/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: p.id,
        name: p.name,
        price: Number(p.price || 0),
        image_url: p.image_url || null,
        category: normalizeProductCategorySlug(p.category)
      })
    });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error || "Produkt konnte nicht gespeichert werden.");
      return false;
    }
    await loadAll();
    return true;
  }

  async function createProduct(p) {
    const res = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: p.name,
        price: Number(p.price || 0),
        image_url: p.image_url || null,
        is_active: p.is_active !== false,
        category: normalizeProductCategorySlug(p.category)
      })
    });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error || "Produkt konnte nicht angelegt werden.");
      return false;
    }
    await loadAll();
    return true;
  }

  async function archiveProduct(p, active) {
    const res = await fetch("/api/admin/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, is_active: active })
    });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error || "Status konnte nicht geändert werden.");
      return;
    }
    await loadAll();
  }

  async function deleteProductPermanently(id) {
    const res = await fetch("/api/admin/products", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error || "Löschen fehlgeschlagen.");
      return false;
    }
    await loadAll();
    return true;
  }

  async function saveMenu(m, isNew = false) {
    const res = await fetch("/api/admin/menus", {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(m)
    });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error || "Menü konnte nicht gespeichert werden.");
      return false;
    }
    await loadAll();
    return true;
  }

  async function toggleMenu(m) {
    await saveMenu({ id: m.id, is_active: !m.is_active });
  }

  async function deleteMenuPermanently(id) {
    const res = await fetch("/api/admin/menus", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error || "Löschen fehlgeschlagen.");
      return false;
    }
    await loadAll();
    return true;
  }

  const maxHourCount = summary?.hourlyDistribution?.length
    ? Math.max(...summary.hourlyDistribution.map((h) => h.count), 1)
    : 1;

  return (
    <div className="space-y-5 pb-10 sm:space-y-6 sm:pb-12">
      <Hero title="Admin-Dashboard" subtitle="Übersicht, Produkte und Menüs · Daten stets aus der Datenbank" />

      <div className="flex flex-wrap gap-2 sm:gap-2.5">
        {[
          { id: "overview", label: "Übersicht" },
          { id: "products", label: "Produkte" },
          { id: "menus", label: "Menüs" }
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            className={`min-h-11 rounded-2xl px-4 py-2.5 text-sm font-bold transition active:scale-[0.99] sm:min-h-0 ${
              tab === t.id ? "bg-slate-900 text-white shadow-md" : "bg-white text-slate-800 ring-1 ring-slate-200 hover:ring-amber-200"
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {err ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm leading-relaxed text-red-800 shadow-sm break-words">{err}</div>
      ) : null}

      {tab === "overview" && summary ? (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-slate-500">Heute – Eingang und Betrieb</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Kpi label="Bestellungen heute (Eingang)" value={summary.ordersToday} hint="Nach Bestellzeitstempel" />
              <Kpi label="Umsatz heute" value={formatMoney(summary.revenueToday)} />
              <Kpi label="Artikel heute (Stück)" value={summary.itemsToday} />
              <Kpi label="Offene Bestellungen heute (Abholung)" value={summary.pendingToday} hint="Status ausstehend, Abholung heute" />
              <Kpi label="Ausgeliefert heute" value={summary.deliveredToday} hint="Auslieferung heute erfasst" />
              <Kpi label="Nicht abgeholt heute" value={summary.notPickedUpToday || 0} hint="Als nicht abgeholt markiert" />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-slate-500">Gesamt · historisch</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <Kpi label="Alle Bestellungen" value={summary.totalOrders} />
              <Kpi label="Gesamtumsatz" value={formatMoney(summary.totalRevenue)} />
              <Kpi label="Verkaufte Artikel (Stück)" value={summary.totalArticlesSold} />
              <Kpi label="Nicht abgeholt gesamt" value={summary.notPickedUpTotal || 0} />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-slate-500">Trends und Verhalten</h2>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-md">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Kalenderwoche</p>
                <p className="mt-1 text-sm text-slate-600">{summary.weekRangeLabel}</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500">Bestellungen KW</p>
                    <p className="text-xl font-black">{summary.ordersThisWeek}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500">Umsatz KW</p>
                    <p className="text-xl font-black">{formatMoney(summary.revenueThisWeek)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500">Vorwoche · Bestellungen</p>
                    <p className="text-lg font-bold text-slate-800">{summary.ordersLastWeek}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500">Vorwoche · Umsatz</p>
                    <p className="text-lg font-bold text-slate-800">{formatMoney(summary.revenueLastWeek)}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  Δ Bestellungen zur Vorwoche:{" "}
                  <span className="font-bold text-slate-900">{summary.weekOverWeekOrdersPct > 0 ? "+" : ""}
                  {summary.weekOverWeekOrdersPct}%</span>
                  {" · "}
                  Δ Umsatz:{" "}
                  <span className="font-bold text-slate-900">{summary.weekOverWeekRevenuePct > 0 ? "+" : ""}
                  {summary.weekOverWeekRevenuePct}%</span>
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-md">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Highlights</p>
                <ul className="mt-3 space-y-2 text-sm">
                  <li>
                    <span className="text-slate-500">Meistbestelltes Produkt:</span>{" "}
                    <span className="font-bold">{summary.topProduct || "—"}</span>
                  </li>
                  <li>
                    <span className="text-slate-500">Meistbestelltes Menü:</span>{" "}
                    <span className="font-bold">{summary.topMenu || "—"}</span>
                  </li>
                  <li>
                    <span className="text-slate-500">Bestellungen 18–21 Uhr:</span>{" "}
                    <span className="font-bold">{summary.orders18to21}</span>
                  </li>
                  <li>
                    <span className="text-slate-500">Peak-Zeit:</span>{" "}
                    <span className="font-bold">{summary.peakHourLabel || "—"}</span>
                    {summary.peakOrderCount > 0 ? (
                      <span className="text-slate-500"> ({summary.peakOrderCount} Bestellungen)</span>
                    ) : null}
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-slate-500">Stundenverteilung (alle Zeiten)</h2>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-md">
              <div className="flex h-28 items-end gap-0.5 sm:gap-1">
                {summary.hourlyDistribution.map((h) => (
                  <div key={h.hour} className="group relative flex-1">
                    <div
                      className="min-h-[4px] w-full rounded-t bg-gradient-to-t from-amber-700 to-orange-400 transition group-hover:from-amber-800"
                      style={{ height: `${Math.max(8, (h.count / maxHourCount) * 100)}%` }}
                      title={`${h.hour} Uhr: ${h.count}`}
                    />
                    <span className="mt-1 hidden text-[9px] text-slate-400 sm:block">{h.hour % 6 === 0 ? h.hour : ""}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">Stunde der Bestellerstellung, alle Bestellungen</p>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-md">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Top 5 Produkte (Stück, gesamt)</h3>
              <ol className="mt-3 space-y-2">
                {(summary.topProducts || []).map((row, idx) => (
                  <li key={row.name} className="flex justify-between text-sm">
                    <span className="text-slate-700">
                      {idx + 1}. {row.name}
                    </span>
                    <span className="font-bold">{row.qty}</span>
                  </li>
                ))}
                {!summary.topProducts?.length ? <li className="text-slate-500">Noch keine Daten.</li> : null}
              </ol>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-md">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Top 5 Menüs (Stück, gesamt)</h3>
              <ol className="mt-3 space-y-2">
                {(summary.topMenus || []).map((row, idx) => (
                  <li key={row.name} className="flex justify-between text-sm">
                    <span className="text-slate-700">
                      {idx + 1}. {row.name}
                    </span>
                    <span className="font-bold">{row.qty}</span>
                  </li>
                ))}
                {!summary.topMenus?.length ? <li className="text-slate-500">Noch keine Daten.</li> : null}
              </ol>
            </div>
          </section>

          <p className="text-center text-xs text-slate-400">Offen für morgen (Vorbestellung): {summary.pendingTomorrow}</p>
        </div>
      ) : null}

      {tab === "overview" && !summary && !err ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-8 text-center text-sm leading-relaxed text-amber-900" aria-live="polite">
          Übersicht wird geladen…
        </div>
      ) : null}

      {tab === "products" ? (
        <ProductsTab
          products={products}
          onUpload={upload}
          onSave={saveProduct}
          onCreate={createProduct}
          onArchive={archiveProduct}
          onHardDelete={deleteProductPermanently}
          onError={setErr}
        />
      ) : null}

      {tab === "menus" ? (
        <MenusTab
          menus={menus}
          products={products}
          onUpload={upload}
          onSave={saveMenu}
          onToggle={toggleMenu}
          onHardDelete={deleteMenuPermanently}
          onError={setErr}
        />
      ) : null}
    </div>
  );
}

function ProductsTab({ products, onUpload, onSave, onCreate, onArchive, onHardDelete, onError }) {
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  function openEdit(p) {
    onError("");
    setCreating(false);
    setDraft({
      id: p.id,
      name: p.name || "",
      price: p.price ?? 0,
      image_url: p.image_url || "",
      is_active: p.is_active,
        category: normalizeProductCategorySlug(p.category)
      });
    setEditOpen(true);
  }

  function openCreate() {
    onError("");
    setCreating(true);
    setDraft({ name: "", price: 0, image_url: "", is_active: true, category: "" });
    setEditOpen(true);
  }

  function closeModal() {
    setEditOpen(false);
    setDraft(null);
    setCreating(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold text-slate-900">Produkte</h2>
        <button
          type="button"
          onClick={openCreate}
          className="min-h-11 w-full rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow-md active:brightness-95 sm:w-auto sm:min-h-0"
        >
          Neues Produkt hinzufügen
        </button>
      </div>

      <div className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        {products.map((p) => (
          <div key={p.id} className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-3 shadow-md ring-1 ring-slate-100 sm:p-4">
            <CardImageMedia src={p.image_url} alt={p.name} />
            <div className="mt-3 flex flex-1 flex-col space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="break-words font-bold text-slate-900">{p.name}</p>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">{productCategoryLabelDe(p.category)}</p>
                  <p className="mt-1 text-lg font-black text-amber-800">{formatMoney(p.price)}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${p.is_active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}
                >
                  {p.is_active ? "Aktiv" : "Archiv"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => openEdit(p)} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white">
                  Bearbeiten
                </button>
                <button
                  type="button"
                  onClick={() => onArchive(p, !p.is_active)}
                  className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-800"
                >
                  {p.is_active ? "Ausblenden" : "Reaktivieren"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onError("");
                    setConfirmDelete({ id: p.id, name: p.name });
                  }}
                  className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-800"
                >
                  Endgültig löschen
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editOpen && draft ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4">
          <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto overscroll-y-contain rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6 [-webkit-overflow-scrolling:touch]">
            <h3 className="text-lg font-bold leading-snug">{creating ? "Neues Produkt" : "Produkt bearbeiten"}</h3>
            <div className="mt-5 space-y-5">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Name</label>
                <input
                  className={productFormFieldClass}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500" htmlFor="product-category">
                  Kategorie
                </label>
                <select
                  id="product-category"
                  className={productFormFieldClass}
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                >
                  {creating ? (
                    <option value="" disabled>
                      Bitte wählen …
                    </option>
                  ) : null}
                  {PRODUCT_CATEGORY_FORM_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Preis (€)</label>
                <input
                  className={productFormFieldClass}
                  type="number"
                  step="0.01"
                  value={draft.price}
                  onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Bild</label>
                <div>
                  <CardImageMediaPreview src={draft.image_url} alt="" />
                </div>
                <label className="mt-1 inline-block cursor-pointer rounded-xl bg-amber-100 px-4 py-2 text-xs font-bold text-amber-900">
                  Bild hochladen oder ersetzen
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        try {
                          setDraft({ ...draft, image_url: await onUpload(f, "products") });
                        } catch (ex) {
                          onError(String(ex.message || ex));
                        }
                      }
                    }}
                  />
                </label>
              </div>
            </div>
            <div className="mt-8 flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
              <button type="button" onClick={closeModal} className="min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:min-h-0">
                Abbrechen
              </button>
              <button
                type="button"
                onClick={async () => {
                  onError("");
                  if (creating && !String(draft.category || "").trim()) {
                    onError("Bitte eine Kategorie wählen.");
                    return;
                  }
                  const ok = creating ? await onCreate(draft) : await onSave(draft);
                  if (ok) closeModal();
                }}
                className="min-h-11 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-slate-800 sm:min-h-0 sm:py-2"
              >
                Speichern
              </button>
            </div>
            <div className="pb-[max(0.25rem,env(safe-area-inset-bottom,0px))]" aria-hidden />
          </div>
        </div>
      ) : null}

      {confirmDelete ? (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4">
          <div className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6">
            <h3 className="text-lg font-bold text-red-900">Endgültig löschen?</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              <strong>{confirmDelete.name}</strong> unwiederbringlich aus der Datenbank entfernen. Wenn dieses Produkt in vergangenen Bestellungen vorkommt,
              ist das Löschen nicht möglich — dann bitte „Ausblenden“ nutzen.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className="min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold sm:min-h-0 sm:py-2" onClick={() => setConfirmDelete(null)}>
                Abbrechen
              </button>
              <button
                type="button"
                className="min-h-11 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white sm:min-h-0 sm:py-2"
                onClick={async () => {
                  await onHardDelete(confirmDelete.id);
                  setConfirmDelete(null);
                }}
              >
                Ja, endgültig löschen
              </button>
            </div>
            <div className="pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]" aria-hidden />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MenusTab({ menus, products, onUpload, onSave, onToggle, onHardDelete, onError }) {
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  function openEdit(m) {
    onError("");
    setCreating(false);
    setDraft({
      id: m.id,
      name: m.name || "",
      description: m.description || "",
      price: m.price ?? 0,
      image_url: m.image_url || "",
      is_active: m.is_active,
      menu_items: Array.isArray(m.menu_items)
        ? m.menu_items
            .map((mi) => ({ product_id: Number(mi.product_id), quantity: Number(mi.quantity || 1) }))
            .filter((mi) => Number.isInteger(mi.product_id) && mi.product_id > 0 && Number.isInteger(mi.quantity) && mi.quantity > 0)
        : []
    });
    setEditOpen(true);
  }

  function openCreate() {
    onError("");
    setCreating(true);
    setDraft({ name: "", description: "", price: 0, image_url: "", is_active: true, menu_items: [] });
    setEditOpen(true);
  }

  function closeModal() {
    setEditOpen(false);
    setDraft(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold text-slate-900">Menüs</h2>
        <button
          type="button"
          onClick={openCreate}
          className="min-h-11 w-full rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow-md active:brightness-95 sm:w-auto sm:min-h-0"
        >
          Neues Menü erstellen
        </button>
      </div>

      <div className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        {menus.map((m) => (
          <div key={m.id} className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-3 shadow-md ring-1 ring-slate-100 sm:p-4">
            <CardImageMedia src={m.image_url} alt={m.name} emojiFallback="📋" />
            <div className="mt-3 flex flex-1 flex-col space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="break-words font-bold text-slate-900">{m.name}</p>
                  <p className="mt-1 line-clamp-3 break-words text-sm leading-relaxed text-slate-600">{m.description || "—"}</p>
                  <p className="mt-2 text-lg font-black text-amber-800">{formatMoney(m.price)}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${m.is_active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}
                >
                  {m.is_active ? "Aktiv" : "Archiv"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => openEdit(m)} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white">
                  Bearbeiten
                </button>
                <button type="button" onClick={() => onToggle(m)} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-800">
                  {m.is_active ? "Ausblenden" : "Reaktivieren"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onError("");
                    setConfirmDelete({ id: m.id, name: m.name });
                  }}
                  className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-800"
                >
                  Endgültig löschen
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editOpen && draft ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4">
          <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto overscroll-y-contain rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6 [-webkit-overflow-scrolling:touch]">
            <h3 className="text-lg font-bold leading-snug">{creating ? "Menü anlegen" : "Menü bearbeiten"}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">Beschreibung: z. B. Inhalt wie 1 Buttercroissant + 1 Cappuccino + 2 Marmeladen</p>
            <div className="mt-5 space-y-5">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Name</label>
                <input
                  className={productFormFieldClass}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Beschreibung</label>
                <textarea
                  className={`min-h-[7rem] w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-base text-slate-900 shadow-sm focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200/50 sm:text-sm`}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Preis (€)</label>
                <input
                  className={productFormFieldClass}
                  type="number"
                  step="0.01"
                  value={draft.price}
                  onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                />
              </div>
              <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Menü-Komposition</label>
                  <button
                    type="button"
                    className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200"
                    onClick={() =>
                      setDraft((s) => ({
                        ...s,
                        menu_items: [...(s.menu_items || []), { product_id: "", quantity: 1 }]
                      }))
                    }
                  >
                    + Position
                  </button>
                </div>
                {(draft.menu_items || []).length === 0 ? (
                  <p className="text-xs text-slate-500">Keine Struktur hinterlegt. Beschreibung bleibt weiterhin sichtbar.</p>
                ) : (
                  <div className="space-y-2">
                    {(draft.menu_items || []).map((row, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_90px_auto] items-center gap-2">
                        <select
                          className={productFormFieldClass}
                          value={row.product_id}
                          onChange={(e) =>
                            setDraft((s) => {
                              const next = [...(s.menu_items || [])];
                              next[idx] = { ...next[idx], product_id: Number(e.target.value || 0) || "" };
                              return { ...s, menu_items: next };
                            })
                          }
                        >
                          <option value="">Produkt wählen…</option>
                          {products
                            .filter((p) => p.is_active !== false)
                            .sort((a, b) => a.name.localeCompare(b.name, "de"))
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                [{productCategoryLabelDe(p.category)}] {p.name}
                              </option>
                            ))}
                        </select>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          className={productFormFieldClass}
                          value={row.quantity}
                          onChange={(e) =>
                            setDraft((s) => {
                              const next = [...(s.menu_items || [])];
                              next[idx] = { ...next[idx], quantity: Math.max(1, Number(e.target.value || 1)) };
                              return { ...s, menu_items: next };
                            })
                          }
                        />
                        <button
                          type="button"
                          className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-xs font-bold text-red-800"
                          onClick={() =>
                            setDraft((s) => ({
                              ...s,
                              menu_items: (s.menu_items || []).filter((_, i) => i !== idx)
                            }))
                          }
                        >
                          Entfernen
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Bild</label>
                <CardImageMediaPreview src={draft.image_url} alt="" emojiFallback="📋" />
                <label className="mt-1 inline-block cursor-pointer rounded-xl bg-amber-100 px-4 py-2 text-xs font-bold text-amber-900">
                  Bild hochladen oder ersetzen
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        try {
                          setDraft({ ...draft, image_url: await onUpload(f, "menus") });
                        } catch (ex) {
                          onError(String(ex.message || ex));
                        }
                      }
                    }}
                  />
                </label>
              </div>
            </div>
            <div className="mt-8 flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
              <button type="button" onClick={closeModal} className="min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:min-h-0 sm:py-2">
                Abbrechen
              </button>
              <button
                type="button"
                onClick={async () => {
                  onError("");
                  const ok = creating
                    ? await onSave(draft, true)
                    : await onSave({
                        id: draft.id,
                        name: draft.name,
                        description: draft.description,
                        price: draft.price,
                        image_url: draft.image_url,
                        menu_items: draft.menu_items
                      });
                  if (ok) closeModal();
                }}
                className="min-h-11 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-slate-800 sm:min-h-0 sm:py-2"
              >
                {creating ? "Erstellen" : "Speichern"}
              </button>
            </div>
            <div className="pb-[max(0.25rem,env(safe-area-inset-bottom,0px))]" aria-hidden />
          </div>
        </div>
      ) : null}

      {confirmDelete ? (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4">
          <div className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6">
            <h3 className="text-lg font-bold text-red-900">Menü endgültig löschen?</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 break-words">
              <strong>{confirmDelete.name}</strong> unwiederbringlich entfernen. Bei Bestellhistorie ist das Löschen gesperrt — dann „Ausblenden“ verwenden.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className="min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold sm:min-h-0 sm:py-2" onClick={() => setConfirmDelete(null)}>
                Abbrechen
              </button>
              <button
                type="button"
                className="min-h-11 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white sm:min-h-0 sm:py-2"
                onClick={async () => {
                  await onHardDelete(confirmDelete.id);
                  setConfirmDelete(null);
                }}
              >
                Ja, endgültig löschen
              </button>
            </div>
            <div className="pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]" aria-hidden />
          </div>
        </div>
      ) : null}
    </div>
  );
}
