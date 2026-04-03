import { NextResponse } from "next/server";
import { berlinDateWithOffset, getBerlinNow } from "@/lib/order-utils";
import { getSupabaseServerClient } from "@/lib/supabase";

const DAY_MATRIX_STATUSES = ["pending", "delivered", "not_picked_up"];

const ORDER_SELECT =
  "id,order_number,customer_name,created_at,status,total_amount,pickup_date,order_items(id,quantity,unit_price,products(name,category),menus(id,name,description,menu_items(product_id,quantity,products(name,category))))";

function pickupDateForService(service) {
  const { date: today, hour } = getBerlinNow();
  if (service === "today") return today;
  if (service === "tomorrow") return berlinDateWithOffset(1);
  return hour < 16 ? today : berlinDateWithOffset(1);
}

function mapOrdersWithSummary(data) {
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

/** Aggregate product quantities (direct + menu_items expansion) for preparation/matrix views. */
function packlistProductsFromOrders(orders) {
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
    .sort((a, b) =>
      String(a.category || "backwaren").localeCompare(String(b.category || "backwaren"), "de") ||
      a.name.localeCompare(b.name, "de")
    );
}

function menuTotalsFromOrders(orders) {
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

export async function GET(req) {
  const supabase = getSupabaseServerClient();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").toLowerCase();
  const pickupDate = pickupDateForService(url.searchParams.get("service"));

  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("pickup_date", pickupDate)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const orders = mapOrdersWithSummary(data);

  const normalizedProducts = packlistProductsFromOrders(orders);
  const preparationSummary = {
    products: normalizedProducts,
    menus: menuTotalsFromOrders(orders)
  };
  const preparationPacklist = normalizedProducts;

  const { data: dayData, error: dayErr } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("pickup_date", pickupDate)
    .in("status", DAY_MATRIX_STATUSES)
    .order("created_at", { ascending: true });

  if (dayErr) return NextResponse.json({ error: dayErr.message }, { status: 500 });

  const dayOrders = mapOrdersWithSummary(dayData);
  const dayMatrixPacklist = packlistProductsFromOrders(dayOrders);

  const filtered = q ? orders.filter((o) => o.customer_name.toLowerCase().includes(q) || String(o.order_number).includes(q)) : orders;
  return NextResponse.json({
    orders: filtered,
    pickupDate,
    preparationSummary,
    preparationPacklist,
    dayMatrixPacklist
  });
}
