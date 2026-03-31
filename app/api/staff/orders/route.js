import { NextResponse } from "next/server";
import { berlinDateWithOffset, getBerlinNow } from "@/lib/order-utils";
import { getSupabaseServerClient } from "@/lib/supabase";

function pickupDateForService(service) {
  const { date: today, hour } = getBerlinNow();
  if (service === "today") return today;
  if (service === "tomorrow") return berlinDateWithOffset(1);
  return hour < 16 ? today : berlinDateWithOffset(1);
}

export async function GET(req) {
  const supabase = getSupabaseServerClient();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").toLowerCase();
  const pickupDate = pickupDateForService(url.searchParams.get("service"));

  const { data, error } = await supabase
    .from("orders")
    .select(
      "id,order_number,customer_name,created_at,status,total_amount,pickup_date,order_items(id,quantity,unit_price,products(name),menus(name,description))"
    )
    .eq("pickup_date", pickupDate)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const orders = (data || []).map((o) => {
    const lines = o.order_items || [];
    const items_summary = lines
      .map((i) => `${i.quantity}× ${i.products?.name || i.menus?.name || "—"}`)
      .join(" · ");
    const short_summary =
      items_summary.length > 90 ? `${items_summary.slice(0, 87)}…` : items_summary || "—";
    return { ...o, items_summary, short_summary };
  });

  const productTotals = new Map();
  const menuTotals = new Map();
  for (const o of orders) {
    for (const i of o.order_items || []) {
      const pq = Number(i.quantity || 0);
      if (i.products?.name) productTotals.set(i.products.name, (productTotals.get(i.products.name) || 0) + pq);
      if (i.menus?.name) menuTotals.set(i.menus.name, (menuTotals.get(i.menus.name) || 0) + pq);
    }
  }
  const preparationSummary = {
    products: [...productTotals.entries()]
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => a.name.localeCompare(b.name, "de")),
    menus: [...menuTotals.entries()]
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"))
  };

  const filtered = q ? orders.filter((o) => o.customer_name.toLowerCase().includes(q) || String(o.order_number).includes(q)) : orders;
  return NextResponse.json({ orders: filtered, pickupDate, preparationSummary });
}
