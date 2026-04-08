"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { readLastOrderSummary } from "@/lib/last-order-storage";

/**
 * Public branch header: same look as AppChrome, 3-tap opens entry to internal login (UI only).
 * No cross-links between /order and /register — only landing lists both flows.
 */
export default function BranchAppChrome({ branchSlug, branchName, headerActions = null }) {
  const pathname = usePathname();
  const base = `/b/${branchSlug}`;
  const orderPath = `${base}/order`;
  const registerPath = `${base}/register`;
  const isLanding = pathname === base;
  const isOrder = pathname === orderPath;
  const isRegister = pathname === registerPath;

  const [hasLastOrder, setHasLastOrder] = useState(false);
  const [open, setOpen] = useState(false);
  const taps = useRef(0);
  const timer = useRef(null);

  function tapLogo() {
    taps.current += 1;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      taps.current = 0;
    }, 900);
    if (taps.current >= 3) {
      taps.current = 0;
      setOpen(true);
    }
  }

  const titleText = isLanding
    ? branchName || "Standort"
    : isRegister
      ? "Registrieren"
      : "Frühstück bestellen";

  useEffect(() => {
    if (!isOrder) {
      setHasLastOrder(false);
      return;
    }
    function syncLastOrder() {
      setHasLastOrder(!!readLastOrderSummary(branchSlug));
    }
    syncLastOrder();
    window.addEventListener("fruehstueck-last-order-changed", syncLastOrder);
    return () => window.removeEventListener("fruehstueck-last-order-changed", syncLastOrder);
  }, [isOrder, branchSlug]);

  return (
    <>
      <header className="mb-5 flex items-center justify-between gap-3 sm:mb-6 sm:gap-4">
        <button
          type="button"
          onClick={tapLogo}
          className="min-h-11 min-w-0 flex-1 text-left text-base font-semibold leading-snug text-amber-950/90 sm:min-h-0 sm:flex-none sm:text-lg"
        >
          {titleText}
        </button>
        <nav className="flex shrink-0 flex-wrap justify-end gap-2 text-xs font-semibold">
          {headerActions}
          {isOrder && hasLastOrder ? (
            <button
              type="button"
              title="Letzte Bestellung ansehen"
              onClick={() => window.dispatchEvent(new Event("fruehstueck-open-last-order"))}
              className="min-h-10 shrink-0 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-2 text-[11px] font-bold text-white shadow-sm ring-1 ring-amber-400/40 transition hover:brightness-105 active:brightness-95 sm:min-h-9 sm:px-3.5 sm:text-xs sm:py-1.5"
            >
              Letzte Bestellung
            </button>
          ) : null}
        </nav>
      </header>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4">
          <div className="max-h-[90dvh] w-full max-w-sm overflow-y-auto overscroll-y-contain rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6 [-webkit-overflow-scrolling:touch]">
            <h2 className="text-lg font-semibold">Interner Zugang</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              Team- und Verwaltungslogin für {branchName ? <strong>{branchName}</strong> : "diesen Standort"}.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-xl px-4 py-2.5 text-sm sm:min-h-0 sm:py-2">
                Schließen
              </button>
              <Link
                href={`/b/${branchSlug}/login`}
                className="min-h-11 inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-center text-sm font-semibold text-white sm:min-h-0 sm:py-2"
              >
                Zum Login
              </Link>
            </div>
            <div className="pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]" aria-hidden />
          </div>
        </div>
      ) : null}
    </>
  );
}
