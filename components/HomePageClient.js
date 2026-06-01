"use client";

import Link from "next/link";

export default function HomePageClient({ branches, loadError }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-yellow/15 to-slate-50">
      <div className="fb-page-narrow">
        <div className="fb-hero mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/75">Frühstück</p>
          <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Bestellen</h1>
          <p className="mt-2 text-sm text-white/90">Standort wählen — wie an der Theke, nur digital.</p>
        </div>

        <ul className="space-y-2">
          {(branches || []).map((b) => (
            <li key={String(b.id)}>
              <Link href={`/b/${b.slug}`} className="fb-list-item font-medium">
                {b.name}
              </Link>
            </li>
          ))}
        </ul>
        {loadError ? (
          <p className="fb-alert-error mt-6">Standorte konnten nicht geladen werden ({loadError})</p>
        ) : null}
        {!loadError && !(branches || []).length ? (
          <div className="fb-empty mt-6">Keine aktiven Standorte in der Datenbank.</div>
        ) : null}
      </div>
    </div>
  );
}
