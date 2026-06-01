"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  CUSTOMER_LOCALES,
  DEFAULT_LOCALE,
  isCustomerLocale,
  localeToBcp47
} from "@/lib/i18n/locale-utils";
import { LOCALE_STORAGE_KEY, messages } from "@/lib/i18n/messages";

const I18nContext = createContext({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key) => key
});

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(DEFAULT_LOCALE);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (stored && isCustomerLocale(stored)) setLocaleState(stored);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = localeToBcp47(locale).split("-")[0];
    }
  }, [locale]);

  const setLocale = useCallback((next) => {
    if (!isCustomerLocale(next)) return;
    setLocaleState(next);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key) => {
      const table = messages[locale] || messages.de;
      return table[key] ?? messages.de[key] ?? key;
    },
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
