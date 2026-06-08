"use client";

import { useState } from "react";

export default function RootRegistrationToggle({ initialEnabled = false }) {
  const [enabled, setEnabled] = useState(Boolean(initialEnabled));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  async function toggle() {
    const next = !enabled;
    setSaving(true);
    setErr("");
    setOk("");
    try {
      const res = await fetch("/api/internal/root/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ registrationEnabled: next })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Einstellung konnte nicht gespeichert werden.");
      setEnabled(next);
      setOk(next ? "Registrierung ist jetzt sichtbar." : "Registrierung ist jetzt ausgeblendet.");
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-orange">Plattform</p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">Registrierung</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Schaltet die Gäste-Registrierung für alle Standorte ein oder aus (Startseite, Team, Admin, API).
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={saving}
          aria-pressed={enabled}
          className={`min-h-12 shrink-0 rounded-2xl px-5 py-3 text-sm font-bold text-white shadow-md transition hover:brightness-95 disabled:opacity-60 ${
            enabled ? "bg-brand-green" : "bg-slate-500"
          }`}
        >
          {saving ? "Speichern…" : enabled ? "Registrierung: AN" : "Registrierung: AUS"}
        </button>
      </div>
      {err ? <p className="mt-3 text-sm text-red-700">{err}</p> : null}
      {ok ? <p className="mt-3 text-sm font-medium text-brand-green">{ok}</p> : null}
    </section>
  );
}
