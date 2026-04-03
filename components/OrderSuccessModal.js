"use client";

import { formatMoney } from "@/lib/format-money";

function formatSavedAt(iso) {
  if (!iso || typeof iso !== "string") return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return null;
  }
}

export default function OrderSuccessModal({
  open,
  customerName,
  orderNumber,
  total,
  lines,
  savedAt,
  onClose
}) {
  if (!open) return null;

  const savedLabel = formatSavedAt(savedAt);
  const safeLines = Array.isArray(lines) ? lines : [];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto overscroll-y-contain rounded-t-3xl bg-white p-5 text-left shadow-2xl sm:rounded-3xl sm:p-6 [-webkit-overflow-scrolling:touch]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-success-title"
      >
        <h2 id="order-success-title" className="text-center text-xl font-bold sm:text-2xl">
          Bestellung eingegangen
        </h2>
        <p className="mt-1 text-center text-sm text-slate-500">Vielen Dank für Ihre Bestellung.</p>

        <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 sm:px-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Name zur Abholung</p>
          <p className="mt-1 break-words text-lg font-bold leading-snug text-slate-900 sm:text-xl">{customerName}</p>
        </div>

        <div className="mt-4 rounded-2xl bg-slate-900 px-4 py-5 text-white sm:px-5">
          <p className="text-xs uppercase tracking-wider text-white/70">Bestellnummer</p>
          <p className="mt-1 text-3xl font-black tabular-nums sm:text-4xl">#{orderNumber ?? "—"}</p>
        </div>

        <div className="mt-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Ihre Auswahl</p>
          {safeLines.length === 0 ? (
            <p className="mt-3 text-base text-slate-600">Keine Positionsdetails verfügbar.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-slate-50/80">
              {safeLines.map((row) =>
                row.header ? (
                  <li key={row.key} className="bg-amber-50/90 px-4 py-3 text-sm font-bold uppercase tracking-wide text-amber-900">
                    {row.title}
                  </li>
                ) : (
                  <li key={row.key} className="flex gap-3 px-4 py-3.5">
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-lg ring-1 ring-slate-100"
                      aria-hidden
                    >
                      {row.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold uppercase text-amber-800/90">{row.badge}</p>
                      <p className="text-base font-semibold leading-snug text-slate-900">{row.title}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {row.qty} × {formatMoney(row.unit)}
                        <span className="font-semibold text-slate-800"> · {formatMoney(row.line)}</span>
                      </p>
                    </div>
                  </li>
                )
              )}
            </ul>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-1 rounded-2xl border border-amber-200/80 bg-amber-50/50 px-4 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:px-5">
          <span className="text-base font-semibold text-amber-950">Gesamtpreis</span>
          <span className="text-2xl font-black tabular-nums text-amber-950 sm:text-3xl">{formatMoney(total ?? 0)}</span>
        </div>

        <p className="mt-5 rounded-2xl bg-amber-50 px-4 py-3.5 text-base font-medium leading-relaxed text-amber-950">
          Bitte nennen Sie uns morgen Ihren Namen und Ihre Bestellnummer.
        </p>
        <p className="mt-3 text-base text-slate-600">Abholung morgen ab 08:00 Uhr.</p>

        {savedLabel ? (
          <p className="mt-3 text-center text-xs text-slate-500">Auf diesem Gerät gespeichert: {savedLabel}</p>
        ) : null}

        <button
          type="button"
          onClick={onClose}
          className="mt-6 min-h-12 w-full rounded-2xl bg-slate-900 px-5 py-3.5 text-base font-semibold text-white active:bg-slate-800"
        >
          Fertig
        </button>
        <div className="pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]" aria-hidden />
      </div>
    </div>
  );
}
