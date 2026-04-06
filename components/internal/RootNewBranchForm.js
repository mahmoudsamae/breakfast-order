"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RootNewBranchForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await fetch("/api/internal/root/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: name.trim(), slug: slug.trim(), is_active: true })
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Speichern fehlgeschlagen.");
        setLoading(false);
        return;
      }
      setName("");
      setSlug("");
      router.refresh();
      if (data.branch?.id != null) {
        router.push(`/internal/root/branches/${data.branch.id}`);
      }
    } catch (ex) {
      setErr(String(ex.message || ex));
    }
    setLoading(false);
  }

  return (
    <section className="fb-card">
      <h2 className="text-sm font-bold text-slate-900">Neuer Standort</h2>
      <p className="mt-1 text-xs text-slate-500">Name und URL-Slug; Sie können Details danach bearbeiten.</p>
      <form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="fb-label" htmlFor="nb-name">
            Anzeigename
          </label>
          <input
            id="nb-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="fb-input"
            placeholder="z. B. AZUR Camping …"
          />
        </div>
        <div>
          <label className="fb-label" htmlFor="nb-slug">
            Slug (URL)
          </label>
          <input
            id="nb-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="fb-input"
            placeholder="z. B. hannover"
          />
        </div>
        <div className="flex items-end">
          <button type="submit" disabled={loading} className="fb-btn-primary w-full">
            {loading ? "…" : "Anlegen"}
          </button>
        </div>
        {err ? <p className="fb-alert-error sm:col-span-2">{err}</p> : null}
      </form>
    </section>
  );
}
