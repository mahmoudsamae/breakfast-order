import { NextResponse } from "next/server";
import { formatEigenesMenueZusatzNote, validateEigenesMenueZusatzEntries } from "@/lib/eigenes-menue";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getBerlinNow, isOrderingOpen, MAX_QTY_PER_ITEM, tomorrowBerlinDate } from "@/lib/order-utils";

export async function POST(req) {
  try {
    const body = await req.json();
    const customerName = (body.customerName || "").trim();
    const productQuantities = body.productQuantities || {};
    const menuQuantities = body.menuQuantities || {};
    const eigenesMenueZusatz = body.eigenesMenueZusatz;
    if (!customerName) return NextResponse.json({ error: "Bitte Namen eingeben." }, { status: 400 });

    const { hour } = getBerlinNow();
    if (!isOrderingOpen(hour)) return NextResponse.json({ error: "Bestellungen nur von 08:00 bis 21:00 Uhr." }, { status: 400 });

    const supabase = getSupabaseServerClient();
    const [{ data: products }, { data: menus }] = await Promise.all([
      supabase.from("products").select("id,price,is_active"),
      supabase.from("menus").select("id,price,is_active")
    ]);
    const productMap = Object.fromEntries((products || []).map((p) => [String(p.id), p]));
    const menuMap = Object.fromEntries((menus || []).map((m) => [String(m.id), m]));

    const items = [];
    let total = 0;
    for (const [id, qtyRaw] of Object.entries(productQuantities)) {
      const qty = Number(qtyRaw || 0);
      const p = productMap[String(id)];
      if (!p?.is_active || qty <= 0) continue;
      if (qty > MAX_QTY_PER_ITEM) return NextResponse.json({ error: `Maximal ${MAX_QTY_PER_ITEM} pro Artikel.` }, { status: 400 });
      const unit = Number(p.price || 0);
      total += qty * unit;
      items.push({ product_id: Number(id), menu_id: null, quantity: qty, unit_price: unit });
    }
    for (const [id, qtyRaw] of Object.entries(menuQuantities)) {
      const qty = Number(qtyRaw || 0);
      const m = menuMap[String(id)];
      if (!m?.is_active || qty <= 0) continue;
      if (qty > MAX_QTY_PER_ITEM) return NextResponse.json({ error: `Maximal ${MAX_QTY_PER_ITEM} pro Artikel.` }, { status: 400 });
      const unit = Number(m.price || 0);
      total += qty * unit;
      items.push({ product_id: null, menu_id: Number(id), quantity: qty, unit_price: unit });
    }
    if (items.length === 0) return NextResponse.json({ error: "Bitte mindestens einen Artikel wählen." }, { status: 400 });

    let extrasTotal = 0;
    let eigenesNote = "";
    try {
      const { entries, extrasTotal: ex } = validateEigenesMenueZusatzEntries(eigenesMenueZusatz);
      extrasTotal = ex;
      if (entries.length > 0) eigenesNote = ` · EM:${formatEigenesMenueZusatzNote(entries)}`;
    } catch (ve) {
      return NextResponse.json({ error: String(ve.message || ve) }, { status: 400 });
    }

    const grandTotal = Math.round((total + extrasTotal) * 100) / 100;
    const nameForOrder = `${customerName}${eigenesNote}`;

    const { data, error } = await supabase.rpc("create_order", {
      p_customer_name: nameForOrder,
      p_pickup_date: tomorrowBerlinDate(),
      p_source: "qr",
      p_items: items,
      p_total_amount: grandTotal
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ orderNumber: data?.[0]?.order_number, orderId: data?.[0]?.order_id });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
