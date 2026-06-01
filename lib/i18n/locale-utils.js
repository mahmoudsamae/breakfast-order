/** Guest order UI locales (German is default). */
export const CUSTOMER_LOCALES = ["de", "en", "nl", "it", "fr"];

export const DEFAULT_LOCALE = "de";

export const LOCALE_STORAGE_KEY = "fruehstueck-locale";

export const LOCALE_LABELS = {
  de: "DE",
  en: "EN",
  nl: "NL",
  it: "IT",
  fr: "FR"
};

/** Native language names for the guest language menu */
export const LOCALE_NAMES = {
  de: "Deutsch",
  en: "English",
  nl: "Nederlands",
  it: "Italiano",
  fr: "Français"
};

export function localeToBcp47(locale) {
  const map = {
    de: "de-DE",
    en: "en-GB",
    nl: "nl-NL",
    it: "it-IT",
    fr: "fr-FR"
  };
  return map[locale] || "de-DE";
}

export function isCustomerLocale(locale) {
  return CUSTOMER_LOCALES.includes(locale);
}
