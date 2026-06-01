import { MAX_QTY_PER_ITEM, tomorrowBerlinDate } from "@/lib/order-utils";

/**
 * @typedef {{ productId?: number | null, menuId?: number | null, quantity: number }} RepeatLineInput
 */

/**
 * Build validated create_order payload from staff-edited lines (products + menus).
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {{ branchId: number, sourceOrderId: number, lines: RepeatLineInput[], pickupDate?: string }} params
 */
export async function createStaffRepeatOrder(supabase, { branchId, sourceOrderId, lines, pickupDate }) {
  const targetPickup = pickupDate || tomorrowBerlinDate();

  const { data: source, error: sourceErr } = await supabase
    .from("orders")
    .select("id,branch_id,customer_name,status")
    .eq("id", sourceOrderId)
    .maybeSingle();

  if (sourceErr) throw sourceErr;
  if (!source) {
    const err = new Error("Ursprungsbestellung nicht gefunden.");
    err.status = 404;
    throw err;
  }
  if (Number(source.branch_id) !== Number(branchId)) {
    const err = new Error("Ursprungsbestellung gehört nicht zu diesem Standort.");
    err.status = 403;
    throw err;
  }
  if (source.status !== "pending") {
    const err = new Error("Vorbestellung nur für ausstehende Bestellungen möglich.");
    err.status = 400;
    throw err;
  }

  const customerName = String(source.customer_name || "").trim();
  if (!customerName) {
    const err = new Error("Bestellung ohne Kundennamen kann nicht wiederholt werden.");
    err.status = 400;
    throw err;
  }

  const [{ data: products }, { data: menus }] = await Promise.all([
    supabase.from("products").select("id,price,is_active,archived_at").eq("branch_id", branchId),
    supabase.from("menus").select("id,price,is_active,archived_at").eq("branch_id", branchId)
  ]);

  const productMap = Object.fromEntries((products || []).map((p) => [String(p.id), p]));
  const menuMap = Object.fromEntries((menus || []).map((m) => [String(m.id), m]));

  const mergedQty = new Map();
  for (const raw of lines || []) {
    const qty = Math.floor(Number(raw?.quantity || 0));
    if (qty <= 0) continue;
    const productId = raw.productId != null ? Number(raw.productId) : null;
    const menuId = raw.menuId != null ? Number(raw.menuId) : null;
    const mergeKey = productId ? `p:${productId}` : menuId ? `m:${menuId}` : null;
    if (!mergeKey) continue;
    mergedQty.set(mergeKey, (mergedQty.get(mergeKey) || 0) + qty);
  }

  const items = [];
  let total = 0;

  for (const [mergeKey, qty] of mergedQty.entries()) {
    if (qty <= 0) continue;
    if (qty > MAX_QTY_PER_ITEM) {
      const err = new Error(`Maximal ${MAX_QTY_PER_ITEM} pro Artikel.`);
      err.status = 400;
      throw err;
    }

    const productId = mergeKey.startsWith("p:") ? Number(mergeKey.slice(2)) : null;
    const menuId = mergeKey.startsWith("m:") ? Number(mergeKey.slice(2)) : null;

    if (productId && menuId) {
      const err = new Error("Ungültige Zeile: Produkt und Menü gleichzeitig.");
      err.status = 400;
      throw err;
    }

    if (productId) {
      const p = productMap[String(productId)];
      if (!p?.is_active || p.archived_at) {
        const err = new Error("Ein Produkt ist nicht mehr verfügbar.");
        err.status = 400;
        throw err;
      }
      const unit = Number(p.price || 0);
      total += qty * unit;
      items.push({ product_id: productId, menu_id: null, quantity: qty, unit_price: unit });
      continue;
    }

    if (menuId) {
      const m = menuMap[String(menuId)];
      if (!m?.is_active || m.archived_at) {
        const err = new Error("Ein Menü ist nicht mehr verfügbar.");
        err.status = 400;
        throw err;
      }
      const unit = Number(m.price || 0);
      total += qty * unit;
      items.push({ product_id: null, menu_id: menuId, quantity: qty, unit_price: unit });
      continue;
    }
  }

  if (items.length === 0) {
    const err = new Error("Bitte mindestens einen Artikel mit Menge größer 0 wählen.");
    err.status = 400;
    throw err;
  }

  const grandTotal = Math.round(total * 100) / 100;

  const { data, error } = await supabase.rpc("create_order", {
    p_customer_name: customerName,
    p_pickup_date: targetPickup,
    p_source: "staff",
    p_items: items,
    p_total_amount: grandTotal,
    p_branch_id: branchId
  });

  if (error) throw error;

  return {
    orderNumber: data?.[0]?.order_number ?? null,
    orderId: data?.[0]?.order_id ?? null,
    pickupDate: targetPickup,
    totalAmount: grandTotal
  };
}
