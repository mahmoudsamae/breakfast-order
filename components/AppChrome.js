"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { INTERNAL_ROLE_COOKIE } from "@/lib/auth-internal";
import { readLastOrderSummary } from "@/lib/last-order-storage";

export default function AppChrome() {
  const router = useRouter();
  const pathname = usePathname();
  const [hasLastOrder, setHasLastOrder] = useState(false);
  const [open, setOpen] = useState(false);
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
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
      setErr("");
      setU("");
      setP("");
    }
  }

  function login(e) {
    e.preventDefault();
    const user = u.trim().toLowerCase();
    const pass = p.trim();
    if (user === "team" && pass === "team") {
      document.cookie = `${INTERNAL_ROLE_COOKIE}=team; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
      setOpen(false);
      router.push("/staff");
      return;
    }
    if (user === "admin" && pass === "admin") {
      document.cookie = `${INTERNAL_ROLE_COOKIE}=admin; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
      setOpen(false);
      router.push("/admin");
      return;
    }
    setErr("Ungültige Zugangsdaten.");
  }

  useEffect(() => {
    if (pathname !== "/order") {
      setHasLastOrder(false);
      return;
    }
    function syncLastOrder() {
      setHasLastOrder(!!readLastOrderSummary());
    }
    syncLastOrder();
    window.addEventListener("fruehstueck-last-order-changed", syncLastOrder);
    return () => window.removeEventListener("fruehstueck-last-order-changed", syncLastOrder);
  }, [pathname]);

  return (
    <>
      <header className="mb-5 flex items-center justify-between gap-3 sm:mb-6 sm:gap-4">
        <button type="button" onClick={tapLogo} className="min-h-11 min-w-0 flex-1 text-left text-base font-semibold leading-snug text-amber-950/90 sm:min-h-0 sm:flex-none sm:text-lg">
          Frühstück bestellen
        </button>
        <nav className="flex shrink-0 gap-2 text-xs font-semibold">
          {pathname !== "/order" ? (
            <Link href="/order" className="min-h-11 rounded-full bg-white px-3 py-2.5 ring-1 ring-slate-200 sm:min-h-0 sm:py-1">
              Bestellen
            </Link>
          ) : hasLastOrder ? (
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
            <h2 className="text-lg font-semibold">Interner Login</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">Nur für Team und Verwaltung.</p>
            <form onSubmit={login} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Benutzername</label>
                <input
                  value={u}
                  onChange={(e) => setU(e.target.value)}
                  autoComplete="username"
                  className="min-h-12 w-full rounded-xl border border-slate-200 px-3 py-3 text-base text-slate-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200/50 sm:py-2 sm:text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Passwort</label>
                <input
                  type="password"
                  value={p}
                  onChange={(e) => setP(e.target.value)}
                  autoComplete="current-password"
                  className="min-h-12 w-full rounded-xl border border-slate-200 px-3 py-3 text-base text-slate-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200/50 sm:py-2 sm:text-sm"
                />
              </div>
              {err ? <p className="text-sm text-red-600">{err}</p> : null}
              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-xl px-4 py-2.5 text-sm sm:min-h-0 sm:py-2">
                  Schließen
                </button>
                <button type="submit" className="min-h-11 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white sm:min-h-0 sm:py-2">
                  Anmelden
                </button>
              </div>
            </form>
            <div className="pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]" aria-hidden />
          </div>
        </div>
      ) : null}
    </>
  );
}
