"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import CustomerLanguageSwitcher from "@/components/LanguageSwitcher";
import { useI18n } from "@/components/I18nProvider";
import { SHOW_REGISTRATION_UI } from "@/lib/feature-flags";
import { readLastOrderSummary } from "@/lib/last-order-storage";

/**
 * Public branch header: 3-tap opens internal login (UI only).
 * Language switcher lives on the guest order page only.
 */
export default function BranchAppChrome({ branchSlug, branchName, headerActions = null, variant }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const base = `/b/${branchSlug}`;
  const orderPath = `${base}/order`;
  const registerPath = `${base}/register`;
  const isLanding = variant === "landing" || pathname === base;
  const isOrder = pathname === orderPath;
  const isRegister = SHOW_REGISTRATION_UI && pathname === registerPath;

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
    ? null
    : isRegister
      ? "Registrieren"
      : isOrder
        ? t("chrome.orderTitle")
        : branchName || "Standort";

  const headerSubtitle =
    isOrder || isRegister
      ? branchName || null
      : isLanding
        ? null
        : "Frühstück & Team";

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

  if (isLanding) {
    return open ? (
      <InternalLoginModal branchSlug={branchSlug} branchName={branchName} onClose={() => setOpen(false)} />
    ) : null;
  }

  return (
    <>
      <header className="mb-5 flex min-h-10 items-center justify-between gap-3 sm:mb-6 sm:gap-4">
        <button type="button" onClick={tapLogo} className="min-w-0 flex-1 sm:flex-none">
          <span className="inline-flex max-w-full items-center gap-2.5 rounded-2xl bg-white px-3 py-2 shadow-sm ring-1 ring-slate-200/90 sm:gap-3 sm:px-4 sm:py-2.5">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-green via-brand-yellow to-brand-orange text-xs font-black text-white shadow-sm sm:h-10 sm:w-10 sm:text-sm"
              aria-hidden
            >
              A
            </span>
            <span className="min-w-0 truncate text-left leading-tight">
              <span className="block truncate text-sm font-bold text-slate-900 sm:text-base">{titleText}</span>
              {headerSubtitle ? (
                <span className="block truncate text-[11px] font-semibold text-brand-teal sm:text-xs">{headerSubtitle}</span>
              ) : null}
            </span>
          </span>
        </button>
        <nav className="flex shrink-0 items-center gap-2">
          {headerActions}
          {isOrder ? <CustomerLanguageSwitcher /> : null}
          {isOrder && hasLastOrder ? (
            <button
              type="button"
              title={t("chrome.lastOrder")}
              onClick={() => window.dispatchEvent(new Event("fruehstueck-open-last-order"))}
              className="inline-flex h-10 max-w-[7.5rem] items-center justify-center rounded-xl bg-brand-teal px-3 text-xs font-bold leading-tight text-white shadow-sm transition hover:brightness-95 active:brightness-90 sm:max-w-none sm:px-3.5 sm:text-xs"
            >
              <span className="line-clamp-2 text-center sm:line-clamp-none">{t("chrome.lastOrder")}</span>
            </button>
          ) : null}
        </nav>
      </header>
      {open ? <InternalLoginModal branchSlug={branchSlug} branchName={branchName} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function InternalLoginModal({ branchSlug, branchName, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90dvh] w-full max-w-sm overflow-y-auto overscroll-y-contain rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6 [-webkit-overflow-scrolling:touch]">
        <h2 className="text-lg font-semibold">Interner Zugang</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          Team- und Verwaltungslogin für {branchName ? <strong>{branchName}</strong> : "diesen Standort"}.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl px-4 py-2.5 text-sm sm:min-h-0 sm:py-2">
            Schließen
          </button>
          <Link
            href={`/b/${branchSlug}/login`}
            className="min-h-11 inline-flex items-center justify-center rounded-xl bg-brand-orange px-4 py-2.5 text-center text-sm font-semibold text-white hover:brightness-95 sm:min-h-0 sm:py-2"
          >
            Zum Login
          </Link>
        </div>
        <div className="pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]" aria-hidden />
      </div>
    </div>
  );
}
