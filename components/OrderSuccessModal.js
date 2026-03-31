"use client";

export default function OrderSuccessModal({ open, customerName, orderNumber, onClose }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto overscroll-y-contain rounded-t-3xl bg-white p-5 text-center shadow-2xl sm:rounded-3xl sm:p-6 [-webkit-overflow-scrolling:touch]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h2 className="text-xl font-bold sm:text-2xl">Bestellung eingegangen</h2>
        <p className="mt-2 break-words text-sm text-slate-600">Für {customerName}</p>
        <div className="mt-5 rounded-2xl bg-slate-900 px-4 py-5 text-white sm:px-5">
          <p className="text-xs uppercase tracking-wider text-white/70">Bestellnummer</p>
          <p className="mt-1 text-3xl font-black tabular-nums sm:text-4xl">#{orderNumber ?? "—"}</p>
        </div>
        <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-left text-sm font-medium leading-relaxed text-amber-950 sm:text-center">
          Bitte nennen Sie uns morgen Ihren Namen und Ihre Bestellnummer.
        </p>
        <p className="mt-3 text-sm text-slate-600">Abholung morgen ab 08:00 Uhr.</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 min-h-12 w-full rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white active:bg-slate-800"
        >
          Fertig
        </button>
        <div className="pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]" aria-hidden />
      </div>
    </div>
  );
}
