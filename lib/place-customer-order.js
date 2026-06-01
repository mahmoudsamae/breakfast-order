import { formatEigenesMenueZusatzNote, validateEigenesMenueZusatzEntries } from "@/lib/eigenes-menue";
import { findDuplicateCustomerOrder } from "@/lib/order-duplicate-check";
import { getBerlinNow, isOrderingOpen, MAX_QTY_PER_ITEM, tomorrowBerlinDate } from "@/lib/order-utils";

export const DUPLICATE_ORDER_CODE = "DUPLICATE_ORDER";

/**
 * Legt eine Gäste-Bestellung an (QR). Wirft bei Validierungsfehlern; bei Duplikat ohne Bestätigung: { duplicate: true, ... }.
 */
export async function placeCustomerOrder(supabase, { branchId, body }) {
  const customerName = (body.customerName || "").trim();
  const productQuantities = body.productQuantities || {};
  const menuQuantities = body.menuQuantities || {};
  const eigenesMenueZusatz = body.eigenesMenueZusatz;
  const confirmDuplicate = Boolean(body.confirmDuplicate);

  if (!customerName) {
    return { ok: false, status: 400, error: "Bitte Namen eingeben." };
  }

  const { hour } = getBerlinNow();
  if (!isOrderingOpen(hour)) {
    return { ok: false, status: 400, error: "Bestellungen nur von 08:00 bis 21:00 Uhr." };
  }

  const pickupDate = tomorrowBerlinDate();

  const [{ data: products }, { data: menus }] = await Promise.all([
    supabase.from("products").select("id,price,is_active").eq("branch_id", branchId),
    supabase.from("menus").select("id,price,is_active").eq("branch_id", branchId)
  ]);
  const productMap = Object.fromEntries((products || []).map((p) => [String(p.id), p]));
  const menuMap = Object.fromEntries((menus || []).map((m) => [String(m.id), m]));

  const items = [];
  let total = 0;
  for (const [id, qtyRaw] of Object.entries(productQuantities)) {
    const qty = Number(qtyRaw || 0);
    const p = productMap[String(id)];
    if (!p?.is_active || qty <= 0) continue;
    if (qty > MAX_QTY_PER_ITEM) {
      return { ok: false, status: 400, error: `Maximal ${MAX_QTY_PER_ITEM} pro Artikel.` };
    }
    const unit = Number(p.price || 0);
    total += qty * unit;
    items.push({ product_id: Number(id), menu_id: null, quantity: qty, unit_price: unit });
  }
  for (const [id, qtyRaw] of Object.entries(menuQuantities)) {
    const qty = Number(qtyRaw || 0);
    const m = menuMap[String(id)];
    if (!m?.is_active || qty <= 0) continue;
    if (qty > MAX_QTY_PER_ITEM) {
      return { ok: false, status: 400, error: `Maximal ${MAX_QTY_PER_ITEM} pro Artikel.` };
    }
    const unit = Number(m.price || 0);
    total += qty * unit;
    items.push({ product_id: null, menu_id: Number(id), quantity: qty, unit_price: unit });
  }
  if (items.length === 0) {
    return { ok: false, status: 400, error: "Bitte mindestens einen Artikel wählen." };
  }

  let extrasTotal = 0;
  let eigenesNote = "";
  try {
    const { entries, extrasTotal: ex } = validateEigenesMenueZusatzEntries(eigenesMenueZusatz);
    extrasTotal = ex;
    if (entries.length > 0) eigenesNote = ` · EM:${formatEigenesMenueZusatzNote(entries)}`;
  } catch (ve) {
    return { ok: false, status: 400, error: String(ve.message || ve) };
  }

  if (!confirmDuplicate) {
    const existing = await findDuplicateCustomerOrder(supabase, {
      branchId,
      pickupDate,
      customerName,
      productQuantities,
      menuQuantities
    });
    if (existing) {
      const nr = existing.orderNumber;
      return {
        ok: false,
        status: 409,
        code: DUPLICATE_ORDER_CODE,
        existingOrderNumber: nr,
        pickupDate,
        message:
          nr != null
            ? `Sie haben für diesen Abholtag bereits dieselbe Bestellung aufgegeben (Bestellnummer ${nr}). Möchten Sie wirklich noch einmal bestellen?`
            : "Sie haben für diesen Abholtag bereits dieselbe Bestellung aufgegeben. Möchten Sie wirklich noch einmal bestellen?"
      };
    }
  }

  const grandTotal = Math.round((total + extrasTotal) * 100) / 100;
  const nameForOrder = `${customerName}${eigenesNote}`;

  const { data, error } = await supabase.rpc("create_order", {
    p_customer_name: nameForOrder,
    p_pickup_date: pickupDate,
    p_source: "qr",
    p_items: items,
    p_total_amount: grandTotal,
    p_branch_id: branchId
  });
  if (error) {
    return { ok: false, status: 500, error: error.message };
  }

  const regNum = body.registrationNumber != null ? Number(body.registrationNumber) : NaN;
  if (Number.isFinite(regNum) && regNum > 0) {
    await supabase
      .from("registrations_analytics")
      .update({ breakfast_ordered: true })
      .eq("branch_id", branchId)
      .eq("registration_number", Math.floor(regNum));
  }

  return {
    ok: true,
    orderNumber: data?.[0]?.order_number,
    orderId: data?.[0]?.order_id
  };
}
