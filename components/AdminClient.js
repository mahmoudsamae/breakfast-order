"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CardImageMedia, CardImageMediaPreview } from "@/components/CardImageMedia";
import { formatMoney } from "@/lib/format-money";
import { NOT_PICKED_UP_REASON_OPTIONS } from "@/lib/not-picked-up-reasons";
import {
  normalizeProductCategorySlug,
  productCategoryLabelDe,
  PRODUCT_CATEGORY_FORM_OPTIONS
} from "@/lib/product-category";
import AdminOverviewInsights from "@/components/admin/AdminOverviewInsights";
import { downloadOrdersExcel } from "@/lib/export-to-excel";

async function upload(file, folder, apiPrefix) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", folder);
  const res = await fetch(`${apiPrefix}/upload`, { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload fehlgeschlagen.");
  return data.url;
}

const productFormFieldClass =
  "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-yellow/50/50 sm:min-h-0 sm:text-sm";

function Hero({ title, subtitle, actions = null }) {
  return (
    <section className="rounded-3xl bg-gradient-to-br from-brand-green via-brand-teal to-brand-orange p-5 text-white shadow-xl sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.2em] text-white/75">Verwaltung</p>
        {actions}
      </div>
      <h1 className="mt-2 text-xl font-bold leading-tight sm:text-2xl">{title}</h1>
      {subtitle ? <p className="mt-2 text-sm leading-snug text-white/90">{subtitle}</p> : null}
    </section>
  );
}

function formatDateTimeDe(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("de-DE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return String(iso);
  }
}

function notPickedUpReasonLabel(reason) {
  if (!reason) return "Kein Grund gespeichert";
  return NOT_PICKED_UP_REASON_OPTIONS.find((x) => x.value === reason)?.label || reason;
}

function NotPickedUpDetailsModal({ rows, onClose }) {
  if (!rows) return null;
  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[88dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="not-picked-up-details-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Nicht abgeholt</p>
            <h3 id="not-picked-up-details-title" className="mt-1 text-lg font-bold text-slate-900">
              Gründe anzeigen
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700"
          >
            Schließen
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {rows.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">Keine Einträge vorhanden.</div>
          ) : (
            rows.map((row) => (
              <div key={row.id} className="rounded-2xl border border-slate-200/90 bg-white px-4 py-3 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      Bestellung {row.orderNumber != null ? `#${row.orderNumber}` : "—"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {row.customerName ? `${row.customerName} · ` : ""}
                      Abholung: {row.pickupDate || "—"} · Bestellt: {formatDateTimeDe(row.createdAt)}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm">
                  <span className="font-semibold text-slate-700">Grund:</span>{" "}
                  <span className="font-bold text-slate-900">{notPickedUpReasonLabel(row.reason)}</span>
                </p>
                {row.note ? (
                  <p className="mt-1 text-sm text-slate-700">
                    <span className="font-semibold text-slate-700">Notiz:</span> {row.note}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminClient({ apiPrefix = "/api/admin", branchLabel = "", branchSlug = "", showRegistration = false }) {
  const [tab, setTab] = useState("overview");
  const [summary, setSummary] = useState(null);
  const [products, setProducts] = useState([]);
  const [menus, setMenus] = useState([]);
  const [err, setErr] = useState("");
  const [exportingAll, setExportingAll] = useState(false);
  const [exportInfo, setExportInfo] = useState("");
  const [notPickedUpOpen, setNotPickedUpOpen] = useState(false);

  const loadAll = useCallback(async () => {
    setErr("");
    try {
      const [s, p, m] = await Promise.all([
        fetch(`${apiPrefix}/summary`, { cache: "no-store" }),
        fetch(`${apiPrefix}/products`, { cache: "no-store" }),
        fetch(`${apiPrefix}/menus`, { cache: "no-store" })
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
    const res = await fetch(`${apiPrefix}/products`, {
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
    const res = await fetch(`${apiPrefix}/products`, {
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
    const res = await fetch(`${apiPrefix}/products`, {
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
    const res = await fetch(`${apiPrefix}/products`, {
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
    const res = await fetch(`${apiPrefix}/menus`, {
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
    const res = await fetch(`${apiPrefix}/menus`, {
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

  function uploadForBranch(file, folder) {
    return upload(file, folder, apiPrefix);
  }

  async function exportAllOrdersExcel() {
    setExportingAll(true);
    setErr("");
    setExportInfo("");
    try {
      const res = await fetch(`${apiPrefix}/orders-export?all=1`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Export fehlgeschlagen.");
      const date = data.date || new Date().toLocaleDateString("en-CA");
      const rowCount = (data.rows || []).length;
      downloadOrdersExcel(data.rows || [], `orders-all-${date}.xlsx`);
      const exported = data.meta?.ordersExported ?? rowCount;
      const pages = data.meta?.fetchedPages;
      setExportInfo(
        pages != null
          ? `Excel exportiert: ${exported.toLocaleString("de-DE")} Bestellungen (${pages} Datenbank-Abfragen).`
          : `Excel exportiert: ${exported.toLocaleString("de-DE")} Bestellungen.`
      );
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setExportingAll(false);
    }
  }

  return (
    <div className="space-y-5 pb-10 sm:space-y-6 sm:pb-12">
      <Hero
        title="Admin-Dashboard"
        subtitle={
          branchLabel
            ? `${branchLabel} · Übersicht, Produkte und Menüs`
            : "Übersicht, Produkte und Menüs · Daten stets aus der Datenbank"
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {showRegistration ? (
              <Link
                href={branchSlug ? `/b/${branchSlug}/register` : "/"}
                className="min-h-11 rounded-2xl bg-white/15 px-4 py-2.5 text-sm font-bold text-white ring-1 ring-white/30"
              >
                Zur Registrierung
              </Link>
            ) : null}
            <Link
              href={branchSlug ? `/b/${branchSlug}/order` : "/"}
              className="min-h-11 rounded-2xl bg-white/15 px-4 py-2.5 text-sm font-bold text-white ring-1 ring-white/30"
            >
              Zum Frühstück
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
        {[
          { id: "overview", label: "Übersicht" },
          { id: "products", label: "Produkte" },
          { id: "menus", label: "Menüs" }
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            className={`min-h-11 rounded-2xl px-4 py-2.5 text-sm font-bold transition active:scale-[0.99] sm:min-h-0 ${
              tab === t.id
                ? "bg-brand-green text-white shadow-md ring-1 ring-brand-green/40"
                : "bg-white text-slate-800 ring-1 ring-slate-200 hover:ring-brand-teal/40"
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto">
          <button
            type="button"
            onClick={exportAllOrdersExcel}
            disabled={exportingAll}
            className="min-h-11 rounded-2xl px-4 py-2.5 text-sm font-bold transition active:scale-[0.99] bg-brand-green/15 text-brand-green ring-1 ring-brand-green/35 disabled:opacity-60"
          >
            {exportingAll ? "Export läuft…" : "Alle Bestellungen (Excel)"}
          </button>
        </div>
      </div>

      {err ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm leading-relaxed text-red-800 shadow-sm break-words">{err}</div>
      ) : null}
      {exportInfo ? (
        <div className="rounded-2xl border border-brand-green/35 bg-brand-green/10 px-4 py-3.5 text-sm leading-relaxed text-brand-green shadow-sm break-words">
          {exportInfo}
        </div>
      ) : null}

      {tab === "overview" && summary ? (
        <AdminOverviewInsights
          summary={summary}
          showRegistration={showRegistration}
          onOpenNotPickedUp={() => setNotPickedUpOpen(true)}
        />
      ) : null}

      {tab === "overview" && !summary && !err ? (
        <div className="rounded-2xl border border-brand-yellow/50 bg-brand-yellow/15 px-4 py-8 text-center text-sm leading-relaxed text-brand-green" aria-live="polite">
          Übersicht wird geladen…
        </div>
      ) : null}
      {notPickedUpOpen ? <NotPickedUpDetailsModal rows={summary?.notPickedUpDetails || []} onClose={() => setNotPickedUpOpen(false)} /> : null}

      {tab === "products" ? (
        <ProductsTab
          products={products}
          onUpload={uploadForBranch}
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
          onUpload={uploadForBranch}
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
          className="min-h-11 w-full rounded-2xl bg-gradient-to-r from-brand-green via-brand-yellow to-brand-orange px-5 py-2.5 text-sm font-bold text-white shadow-md active:brightness-95 sm:w-auto sm:min-h-0"
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
                  <p className="mt-1 text-lg font-black text-brand-green">{formatMoney(p.price)}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${p.is_active ? "bg-brand-green/15 text-brand-green" : "bg-slate-200 text-slate-600"}`}
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
                <label className="mt-1 inline-block cursor-pointer rounded-xl bg-brand-yellow/25 px-4 py-2 text-xs font-bold text-brand-green">
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
          className="min-h-11 w-full rounded-2xl bg-gradient-to-r from-brand-green via-brand-yellow to-brand-orange px-5 py-2.5 text-sm font-bold text-white shadow-md active:brightness-95 sm:w-auto sm:min-h-0"
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
                  <p className="mt-2 text-lg font-black text-brand-green">{formatMoney(m.price)}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${m.is_active ? "bg-brand-green/15 text-brand-green" : "bg-slate-200 text-slate-600"}`}
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
                  className={`min-h-[7rem] w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-base text-slate-900 shadow-sm focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-yellow/50/50 sm:text-sm`}
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
                <label className="mt-1 inline-block cursor-pointer rounded-xl bg-brand-yellow/25 px-4 py-2 text-xs font-bold text-brand-green">
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
