/**
 * Gruppiert Katalog-Produkte für /order nach `products.category`.
 */

import { normalizeProductCategorySlug } from "@/lib/product-category";

export function groupProductsForOrderPage(products) {
  const backwaren = [];
  const heissgetraenke = [];
  const marmeladeExtras = [];

  for (const p of products) {
    const c = normalizeProductCategorySlug(p.category);
    if (c === "getraenke") heissgetraenke.push(p);
    else if (c === "extras") marmeladeExtras.push(p);
    else backwaren.push(p);
  }

  return { backwaren, heissgetraenke, marmeladeExtras };
}
