/**
 * Produkt-Kategorien: nur die Slugs werden in der DB gespeichert.
 * Deutsche Beschriftungen ausschließlich für die Oberfläche.
 */

export const PRODUCT_CATEGORY_SLUGS = Object.freeze(["backwaren", "getraenke", "extras"]);

const SLUG_SET = new Set(PRODUCT_CATEGORY_SLUGS);

export const PRODUCT_CATEGORY_LABEL_DE = Object.freeze({
  backwaren: "Backwaren",
  getraenke: "Heißgetränke",
  extras: "Marmelade & Extras"
});

/** Für Admin-Select: value = Slug, label = Deutsch (value nie ein Label). */
export const PRODUCT_CATEGORY_FORM_OPTIONS = Object.freeze(
  PRODUCT_CATEGORY_SLUGS.map((value) => ({
    value,
    label: PRODUCT_CATEGORY_LABEL_DE[value]
  }))
);

/**
 * Liefert genau einen der drei Slugs. Unbekannt/leer → backwaren.
 */
export function normalizeProductCategorySlug(raw) {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFC");
  if (SLUG_SET.has(s)) return s;
  return "backwaren";
}

/**
 * Deutsche Anzeige für einen gespeicherten Slug (nie den Roh-DB-Wortlaut durchreichen).
 */
export function productCategoryLabelDe(slug) {
  const canonical = normalizeProductCategorySlug(slug);
  return PRODUCT_CATEGORY_LABEL_DE[canonical];
}
