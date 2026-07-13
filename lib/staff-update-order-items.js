import { MAX_QTY_PER_ITEM } from "@/lib/order-utils";

/**
 * Replace order_items for a pending order and recalculate total_amount.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {{ branchId: number, orderId: number, lines: { productId?: number|null, menuId?: number|null, quantity: number }[] }} params
 */
export async function updateStaffOrderItems(supabase, { branchId, orderId, lines }) {
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id,branch_id,status")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr) throw orderErr;
  if (!order) {
    const err = new Error("Bestellung nicht gefunden.");
    err.status = 404;
    throw err;
  }
  if (Number(order.branch_id) !== Number(branchId)) {
    const err = new Error("Bestellung gehört nicht zu diesem Standort.");
    err.status = 403;
    throw err;
  }
  if (order.status !== "pending") {
    const err = new Error("Nur offene Bestellungen können bearbeitet werden.");
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

  const rows = [];
  let total = 0;

  for (const [mergeKey, qty] of mergedQty.entries()) {
    if (qty > MAX_QTY_PER_ITEM) {
      const err = new Error(`Maximal ${MAX_QTY_PER_ITEM} pro Artikel.`);
      err.status = 400;
      throw err;
    }

    const productId = mergeKey.startsWith("p:") ? Number(mergeKey.slice(2)) : null;
    const menuId = mergeKey.startsWith("m:") ? Number(mergeKey.slice(2)) : null;

    if (productId) {
      const p = productMap[String(productId)];
      if (!p?.is_active || p.archived_at) {
        const err = new Error("Ein Produkt ist nicht mehr verfügbar.");
        err.status = 400;
        throw err;
      }
      const unit = Number(p.price || 0);
      total += qty * unit;
      rows.push({ order_id: orderId, product_id: productId, menu_id: null, quantity: qty, unit_price: unit });
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
      rows.push({ order_id: orderId, product_id: null, menu_id: menuId, quantity: qty, unit_price: unit });
    }
  }

  if (rows.length === 0) {
    const err = new Error("Bitte mindestens einen Artikel mit Menge größer 0 wählen.");
    err.status = 400;
    throw err;
  }

  const grandTotal = Math.round(total * 100) / 100;

  const { error: delErr } = await supabase.from("order_items").delete().eq("order_id", orderId);
  if (delErr) throw delErr;

  const { error: insErr } = await supabase.from("order_items").insert(rows);
  if (insErr) throw insErr;

  const { error: updErr } = await supabase
    .from("orders")
    .update({ total_amount: grandTotal })
    .eq("id", orderId)
    .eq("branch_id", branchId)
    .eq("status", "pending");

  if (updErr) throw updErr;

  return { totalAmount: grandTotal, lineCount: rows.length };
}
