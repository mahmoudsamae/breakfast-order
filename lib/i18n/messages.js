import de from "@/lib/i18n/translations/de";
import en from "@/lib/i18n/translations/en";
import fr from "@/lib/i18n/translations/fr";
import it from "@/lib/i18n/translations/it";
import nl from "@/lib/i18n/translations/nl";
import {
  CUSTOMER_LOCALES,
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY
} from "@/lib/i18n/locale-utils";

export { CUSTOMER_LOCALES, DEFAULT_LOCALE, LOCALE_STORAGE_KEY };

/** @type {Record<string, Record<string, string>>} */
export const messages = {
  de,
  en,
  nl,
  it,
  fr
};

/** @deprecated use CUSTOMER_LOCALES */
export const LOCALES = CUSTOMER_LOCALES;
