/** Name ohne „ · EM:…“-Suffix, für Vergleich. */
export function normalizeCustomerNameForDuplicateCheck(name) {
  const raw = String(name || "").trim();
  const idx = raw.indexOf(" · EM:");
  const base = idx === -1 ? raw : raw.slice(0, idx).trim();
  return base.toLowerCase().replace(/\s+/g, " ");
}

/** Fingerabdruck aus Warenkorb oder order_items (nur Produkt-/Menü-Zeilen). */
export function buildOrderItemsFingerprint(productQuantities, menuQuantities) {
  const parts = [];
  for (const [id, qtyRaw] of Object.entries(productQuantities || {})) {
    const q = Number(qtyRaw || 0);
    if (q > 0) parts.push(`p:${id}:${q}`);
  }
  for (const [id, qtyRaw] of Object.entries(menuQuantities || {})) {
    const q = Number(qtyRaw || 0);
    if (q > 0) parts.push(`m:${id}:${q}`);
  }
  parts.sort();
  return `${parts.join("|")}#`;
}

export function buildOrderItemsFingerprintFromRows(orderItems) {
  const productQuantities = {};
  const menuQuantities = {};
  for (const row of orderItems || []) {
    const q = Number(row.quantity || 0);
    if (q <= 0) continue;
    if (row.product_id != null) productQuantities[String(row.product_id)] = q;
    else if (row.menu_id != null) menuQuantities[String(row.menu_id)] = q;
  }
  return buildOrderItemsFingerprint(productQuantities, menuQuantities);
}

/**
 * Sucht eine bestehende Bestellung mit gleichem Namen, Abholdatum und Warenkorb.
 * @returns {Promise<{ orderId: string, orderNumber: number } | null>}
 */
export async function findDuplicateCustomerOrder(supabase, {
  branchId,
  pickupDate,
  customerName,
  productQuantities,
  menuQuantities
}) {
  const normalized = normalizeCustomerNameForDuplicateCheck(customerName);
  if (!normalized) return null;

  const targetFingerprint = buildOrderItemsFingerprint(productQuantities, menuQuantities);

  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, order_number, customer_name, order_items(product_id, menu_id, quantity)")
    .eq("branch_id", branchId)
    .eq("pickup_date", pickupDate);

  if (error) throw error;

  for (const order of orders || []) {
    if (normalizeCustomerNameForDuplicateCheck(order.customer_name) !== normalized) continue;
    const existingFp = buildOrderItemsFingerprintFromRows(order.order_items);
    if (existingFp === targetFingerprint) {
      return {
        orderId: order.id,
        orderNumber: Number(order.order_number)
      };
    }
  }
  return null;
}
