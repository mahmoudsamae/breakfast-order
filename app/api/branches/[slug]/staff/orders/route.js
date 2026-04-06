import { NextResponse } from "next/server";
import { requireBranchSession } from "@/lib/api-branch-guard";
import { fetchBranchBySlug } from "@/lib/branch-server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getBerlinNow, MAX_QTY_PER_ITEM } from "@/lib/order-utils";
import {
  DAY_MATRIX_STATUSES,
  mapOrdersWithSummary,
  menuTotalsFromOrders,
  packlistProductsFromOrders,
  pickupDateForService,
  STAFF_ORDER_SELECT
} from "@/lib/staff-orders-shared";

export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  const { error: authErr } = await requireBranchSession(params.slug, ["team", "admin"]);
  if (authErr) return authErr;

  const { branch, error: brErr } = await fetchBranchBySlug(params.slug);
  if (brErr || !branch) return NextResponse.json({ error: "Standort nicht gefunden." }, { status: 404 });

  const supabase = getSupabaseServerClient();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").toLowerCase();
  const pickupDate = pickupDateForService(url.searchParams.get("service"));
  const branchId = branch.id;
  const [{ data: productsData, error: productsErr }, { data: menusData, error: menusErr }] = await Promise.all([
    supabase
      .from("products")
      .select("id,name,price,category,is_active")
      .eq("branch_id", branchId)
      .eq("category", "backwaren")
      .eq("is_active", true)
      .is("archived_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("menus")
      .select("id,name,price,is_active")
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .is("archived_at", null)
      .order("name", { ascending: true })
  ]);
  if (productsErr) return NextResponse.json({ error: productsErr.message }, { status: 500 });
  if (menusErr) return NextResponse.json({ error: menusErr.message }, { status: 500 });

  const { data, error } = await supabase
    .from("orders")
    .select(STAFF_ORDER_SELECT)
    .eq("branch_id", branchId)
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
    .select(STAFF_ORDER_SELECT)
    .eq("branch_id", branchId)
    .eq("pickup_date", pickupDate)
    .in("status", DAY_MATRIX_STATUSES)
    .order("created_at", { ascending: true });

  if (dayErr) return NextResponse.json({ error: dayErr.message }, { status: 500 });

  const dayOrders = mapOrdersWithSummary(dayData);
  const dayMatrixPacklist = packlistProductsFromOrders(dayOrders);

  const filtered = q
    ? orders.filter((o) => o.customer_name.toLowerCase().includes(q) || String(o.order_number).includes(q))
    : orders;
  return NextResponse.json({
    orders: filtered,
    pickupDate,
    preparationSummary,
    preparationPacklist,
    dayMatrixPacklist,
    catalog: {
      products: productsData || [],
      menus: menusData || []
    }
  });
}

export async function POST(req, { params }) {
  const { error: authErr } = await requireBranchSession(params.slug, ["team", "admin"]);
  if (authErr) return authErr;

  const { branch, error: brErr } = await fetchBranchBySlug(params.slug);
  if (brErr || !branch) return NextResponse.json({ error: "Standort nicht gefunden." }, { status: 404 });

  try {
    const body = await req.json();
    const customerNameRaw = String(body.customerName || "").trim();
    const customerName = customerNameRaw || "Vor-Ort-Verkauf";
    const productQuantities = body.productQuantities || {};
    const { date: todayBerlin } = getBerlinNow();
    const pickupDate = String(body.pickupDate || todayBerlin);
    if (pickupDate !== todayBerlin) {
      return NextResponse.json({ error: "Manuelle Erfassung ist nur für heute möglich." }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const branchId = branch.id;
    const { data: products } = await supabase
      .from("products")
      .select("id,price,is_active,category")
      .eq("branch_id", branchId);
    const productMap = Object.fromEntries((products || []).map((p) => [String(p.id), p]));

    const items = [];
    let total = 0;
    for (const [id, qtyRaw] of Object.entries(productQuantities)) {
      const qty = Number(qtyRaw || 0);
      const p = productMap[String(id)];
      if (!p?.is_active || String(p.category) !== "backwaren" || qty <= 0) continue;
      if (qty > MAX_QTY_PER_ITEM) {
        return NextResponse.json({ error: `Maximal ${MAX_QTY_PER_ITEM} pro Artikel.` }, { status: 400 });
      }
      const unit = Number(p.price || 0);
      total += qty * unit;
      items.push({ product_id: Number(id), menu_id: null, quantity: qty, unit_price: unit });
    }
    if (items.length === 0) {
      return NextResponse.json({ error: "Bitte mindestens einen Artikel eintragen." }, { status: 400 });
    }

    const grandTotal = Math.round(total * 100) / 100;
    const { data, error } = await supabase.rpc("create_order", {
      p_customer_name: customerName,
      p_pickup_date: pickupDate,
      p_source: "staff",
      p_items: items,
      p_total_amount: grandTotal,
      p_branch_id: branchId
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      orderNumber: data?.[0]?.order_number ?? null,
      orderId: data?.[0]?.order_id ?? null
    });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
