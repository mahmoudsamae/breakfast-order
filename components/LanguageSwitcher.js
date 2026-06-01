"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { CUSTOMER_LOCALES, LOCALE_LABELS, LOCALE_NAMES } from "@/lib/i18n/locale-utils";

function GlobeIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M3 12h18M12 3c2.5 2.8 3.8 6.2 3.8 9s-1.3 6.2-3.8 9M12 3c-2.5 2.8-3.8 6.2-3.8 9s1.3 6.2 3.8 9"
        stroke="currentColor"
        strokeWidth="1.75"
      />
    </svg>
  );
}

/** Compact language menu for the guest order header (dropdown). */
export default function CustomerLanguageSwitcher({ className = "" }) {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(next) {
    setLocale(next);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 min-w-[4.25rem] items-center justify-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-2.5 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-100 transition hover:border-brand-teal/40 hover:bg-slate-50/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/50 sm:min-w-0 sm:px-3"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        title={LOCALE_NAMES[locale]}
      >
        <GlobeIcon className="h-4 w-4 shrink-0 text-brand-teal" />
        <span className="tabular-nums">{LOCALE_LABELS[locale]}</span>
        <svg
          className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Sprache / Language"
          className="absolute right-0 top-[calc(100%+0.35rem)] z-30 min-w-[11.5rem] overflow-hidden rounded-xl border border-slate-200/90 bg-white py-1 shadow-lg ring-1 ring-slate-100"
        >
          {CUSTOMER_LOCALES.map((code) => {
            const selected = locale === code;
            return (
              <li key={code} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => pick(code)}
                  className={`flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm transition ${
                    selected
                      ? "bg-brand-green/10 font-semibold text-brand-green"
                      : "font-medium text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span>{LOCALE_NAMES[code]}</span>
                  <span
                    className={`text-xs font-bold tabular-nums ${selected ? "text-brand-green" : "text-slate-400"}`}
                  >
                    {LOCALE_LABELS[code]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
