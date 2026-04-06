"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { normalizeBranchSlug } from "@/lib/branch-slug";


export default function RootBranchDangerZone({
  branchId,
  branchName,
  slug,
  isActive,
  onIsActiveChange,
  stats
}) {
  const router = useRouter();
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [destroyOpen, setDestroyOpen] = useState(false);
  const [confirmSlug, setConfirmSlug] = useState("");
  const [ackDestroy, setAckDestroy] = useState(false);
  const [err, setErr] = useState("");
  const [loadingDeact, setLoadingDeact] = useState(false);
  const [loadingDestroy, setLoadingDestroy] = useState(false);

  const canonical = normalizeBranchSlug(slug);

  async function patchActive(next) {
    setErr("");
    setLoadingDeact(true);
    try {
      const res = await fetch(`/api/internal/root/branches/${branchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ is_active: next })
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Aktion fehlgeschlagen.");
        setLoadingDeact(false);
        return;
      }
      onIsActiveChange?.(next);
      setDeactivateOpen(false);
      router.refresh();
    } catch (e) {
      setErr(String(e.message || e));
    }
    setLoadingDeact(false);
  }

  async function destroy() {
    setErr("");
    if (!ackDestroy) {
      setErr("Bitte die Konsequenzen bestätigen.");
      return;
    }
    if (normalizeBranchSlug(confirmSlug) !== canonical) {
      setErr("Slug-Bestätigung ist falsch.");
      return;
    }
    setLoadingDestroy(true);
    try {
      const res = await fetch(`/api/internal/root/branches/${branchId}/destroy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ confirmSlug })
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Löschen fehlgeschlagen.");
        setLoadingDestroy(false);
        return;
      }
      router.push("/internal/root/branches");
      router.refresh();
    } catch (e) {
      setErr(String(e.message || e));
    }
    setLoadingDestroy(false);
  }

  return (
    <section className="rounded-2xl border border-red-200/80 bg-red-50/40 p-5 shadow-sm ring-1 ring-red-100/80">
      <h2 className="text-sm font-bold text-red-950">Gefahrenbereich</h2>
      <p className="mt-1 text-xs leading-relaxed text-red-900/80">
        Änderungen hier betreffen den Standort <strong>{branchName}</strong> (<code className="rounded bg-white/80 px-1">/b/{slug}</code>
        ).
      </p>

      <div className="mt-6 space-y-6">
        <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4">
          <h3 className="text-sm font-semibold text-amber-950">Standort deaktivieren (empfohlen)</h3>
          <p className="mt-2 text-xs leading-relaxed text-amber-950/90">
            Der Standort verschwindet von der öffentlichen Startseite. Bestellseite, Team- und Admin-Zugang über die URL sind nicht
            mehr erreichbar (wie bei „nicht gefunden“).{" "}
            <strong>Alle Daten bleiben in der Datenbank</strong> — Bestellungen, Produkte, Menüs und Konten sind unverändert.
            Sie können den Standort später wieder aktivieren.
          </p>
          {isActive ? (
            <button
              type="button"
              onClick={() => {
                setErr("");
                setDeactivateOpen(true);
              }}
              className="fb-btn-secondary mt-4 border-amber-300 bg-white text-amber-950"
            >
              Deaktivieren…
            </button>
          ) : (
            <button
              type="button"
              disabled={loadingDeact}
              onClick={() => patchActive(true)}
              className="fb-btn-primary mt-4"
            >
              {loadingDeact ? "…" : "Standort wieder aktivieren"}
            </button>
          )}
        </div>

        <div className="rounded-xl border border-red-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-red-950">Standort endgültig löschen</h3>
          <p className="mt-2 text-xs leading-relaxed text-red-900/90">
            <strong>Unwiderruflich:</strong> Es werden alle zugehörigen Bestellungen inkl. Positionen, Tageszähler, Produkte, Menüs
            (inkl. Menü-Zeilen) und dieser Standort selbst gelöscht. Branch-Logins werden mitgelöscht. Storage-Bilder können in
            Supabase Storage verbleiben — bei Bedarf dort manuell bereinigen.
          </p>
          {stats ? (
            <ul className="mt-3 list-inside list-disc text-xs text-red-900/85">
              <li>Bestellungen: {stats.orders}</li>
              <li>Produkte: {stats.products}</li>
              <li>Menüs: {stats.menus}</li>
              <li>Branch-Konten: {stats.credentials}</li>
            </ul>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setErr("");
              setConfirmSlug("");
              setAckDestroy(false);
              setDestroyOpen(true);
            }}
            className="fb-btn-danger mt-4"
          >
            Endgültig löschen…
          </button>
        </div>
      </div>

      {err ? <p className="fb-alert-error mt-4">{err}</p> : null}

      {deactivateOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4">
          <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6">
            <h4 className="text-lg font-semibold text-slate-900">Standort deaktivieren?</h4>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              <strong>{branchName}</strong> wird aus der öffentlichen Liste entfernt und die URLs für Bestellung/Team/Admin liefern
              keinen Zugriff mehr. Daten bleiben erhalten.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button type="button" className="fb-btn-secondary" onClick={() => setDeactivateOpen(false)}>
                Abbrechen
              </button>
              <button
                type="button"
                disabled={loadingDeact}
                className="fb-btn-primary"
                onClick={() => patchActive(false)}
              >
                {loadingDeact ? "…" : "Deaktivieren"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {destroyOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4">
          <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6">
            <h4 className="text-lg font-semibold text-red-950">Standort wirklich löschen?</h4>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Geben Sie den Slug <code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-800">{canonical}</code> ein, um zu
              bestätigen.
            </p>
            <label className="mt-4 block text-xs font-medium text-slate-600">Slug bestätigen</label>
            <input
              className="fb-input mt-1"
              value={confirmSlug}
              onChange={(e) => setConfirmSlug(e.target.value)}
              autoComplete="off"
            />
            <label className="mt-4 flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-1 rounded border-slate-300"
                checked={ackDestroy}
                onChange={(e) => setAckDestroy(e.target.checked)}
              />
              <span>Ich verstehe, dass alle genannten Daten zu diesem Standort unwiderruflich gelöscht werden.</span>
            </label>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="fb-btn-secondary"
                onClick={() => {
                  setDestroyOpen(false);
                  setConfirmSlug("");
                  setAckDestroy(false);
                }}
              >
                Abbrechen
              </button>
              <button type="button" disabled={loadingDestroy} className="fb-btn-danger" onClick={destroy}>
                {loadingDestroy ? "…" : "Endgültig löschen"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
