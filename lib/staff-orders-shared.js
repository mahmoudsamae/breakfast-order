import { berlinDateWithOffset, getBerlinNow } from "@/lib/order-utils";

export const STAFF_ORDER_SELECT =
  "id,order_number,customer_name,created_at,status,total_amount,pickup_date,order_items(id,quantity,unit_price,products(name,category,image_url),menus(id,name,description,image_url,menu_items(product_id,quantity,products(name,category,image_url))))";

export const DAY_MATRIX_STATUSES = ["pending", "delivered", "not_picked_up"];

export function pickupDateForService(service) {
  const { date: today, hour } = getBerlinNow();
  if (service === "today") return today;
  if (service === "tomorrow") return berlinDateWithOffset(1);
  return hour < 16 ? today : berlinDateWithOffset(1);
}

export function mapOrdersWithSummary(data) {
  return (data || []).map((o) => {
    const lines = o.order_items || [];
    const items_summary = lines
      .map((i) => `${i.quantity}× ${i.products?.name || i.menus?.name || "—"}`)
      .join(" · ");
    const short_summary =
      items_summary.length > 90 ? `${items_summary.slice(0, 87)}…` : items_summary || "—";
    return { ...o, items_summary, short_summary };
  });
}

export function packlistProductsFromOrders(orders) {
  const preparationPackMap = new Map();
  function addProductContribution(name, category, orderNumber, qty) {
    if (!name) return;
    const n = Number(qty || 0);
    if (n <= 0) return;
    const key = String(name);
    const cur =
      preparationPackMap.get(key) || {
        name: key,
        category: category || "backwaren",
        qty: 0,
        by_order: new Map()
      };
    cur.qty += n;
    cur.by_order.set(Number(orderNumber), (cur.by_order.get(Number(orderNumber)) || 0) + n);
    preparationPackMap.set(key, cur);
  }
  for (const o of orders) {
    for (const i of o.order_items || []) {
      const pq = Number(i.quantity || 0);
      if (i.products?.name) {
        addProductContribution(i.products.name, i.products?.category, o.order_number, pq);
      }
      if (i.menus?.menu_items?.length) {
        for (const mi of i.menus.menu_items) {
          const expandedQty = pq * Number(mi.quantity || 0);
          addProductContribution(mi.products?.name, mi.products?.category, o.order_number, expandedQty);
        }
      }
    }
  }
  return [...preparationPackMap.values()]
    .map((row) => {
      const per_order = [...row.by_order.entries()]
        .map(([order_number, qty]) => ({ order_number, qty }))
        .sort((a, b) => a.order_number - b.order_number);
      return {
        name: row.name,
        category: row.category,
        qty: row.qty,
        per_order
      };
    })
    .sort(
      (a, b) =>
        String(a.category || "backwaren").localeCompare(String(b.category || "backwaren"), "de") ||
        a.name.localeCompare(b.name, "de")
    );
}

export function menuTotalsFromOrders(orders) {
  const menuTotals = new Map();
  for (const o of orders) {
    for (const i of o.order_items || []) {
      const pq = Number(i.quantity || 0);
      if (i.menus?.name) menuTotals.set(i.menus.name, (menuTotals.get(i.menus.name) || 0) + pq);
    }
  }
  return [...menuTotals.entries()]
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}
