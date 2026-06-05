import { NextResponse } from "next/server";
import { requireBranchSession } from "@/lib/api-branch-guard";
import { fetchBranchBySlug } from "@/lib/branch-server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { fetchStaffCatalog } from "@/lib/staff-catalog";
import { getBerlinNow, MAX_QTY_PER_ITEM, tomorrowBerlinDate } from "@/lib/order-utils";
import {
  autoHideDoneOrdersBeforeToday,
  fetchStaffDayMatrixOrders,
  fetchStaffOrderListCounts,
  fetchStaffOrdersForList
} from "@/lib/staff-orders-list";
import {
  mapOrdersWithSummary,
  menuTotalsFromOrders,
  packlistProductsFromOrders,
  pickupDateForService,
  isMissingPaidAtColumn
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
  const listMode = url.searchParams.get("list") === "done" ? "done" : "open";
  const pickupDate = pickupDateForService(url.searchParams.get("service"));
  const branchId = branch.id;
  const { catalog, error: catalogErr } = await fetchStaffCatalog(supabase, branchId);
  if (catalogErr) return NextResponse.json({ error: catalogErr.message }, { status: 500 });

  const { date: todayBerlin } = getBerlinNow();
  try {
    await autoHideDoneOrdersBeforeToday(supabase, { branchId, todayYmd: todayBerlin });
  } catch (autoErr) {
    return NextResponse.json({ error: String(autoErr.message || autoErr) }, { status: 500 });
  }

  const [{ orders: listOrders, error: listErr }, countsRes] = await Promise.all([
    fetchStaffOrdersForList(supabase, { branchId, pickupDate, listMode }),
    fetchStaffOrderListCounts(supabase, { branchId, pickupDate })
  ]);

  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });
  if (countsRes.error) return NextResponse.json({ error: countsRes.error.message }, { status: 500 });

  const orders = listOrders;
  let pendingForPrep = orders;
  if (listMode === "done") {
    const openRes = await fetchStaffOrdersForList(supabase, { branchId, pickupDate, listMode: "open" });
    if (openRes.error) return NextResponse.json({ error: openRes.error.message }, { status: 500 });
    pendingForPrep = openRes.orders;
  }

  const normalizedProducts = packlistProductsFromOrders(pendingForPrep);
  const preparationSummary = {
    products: normalizedProducts,
    menus: menuTotalsFromOrders(pendingForPrep)
  };
  const preparationPacklist = normalizedProducts;

  const { data: dayData, error: dayErr } = await fetchStaffDayMatrixOrders(supabase, { branchId, pickupDate });

  if (dayErr) return NextResponse.json({ error: dayErr.message }, { status: 500 });

  const dayOrders = mapOrdersWithSummary(dayData);
  const dayMatrixPacklist = packlistProductsFromOrders(dayOrders);

  const filtered = q
    ? orders.filter((o) => o.customer_name.toLowerCase().includes(q) || String(o.order_number).includes(q))
    : orders;
  return NextResponse.json({
    orders: filtered,
    listMode,
    pickupDate,
    counts: {
      open: countsRes.openCount,
      done: countsRes.doneCount
    },
    staffHiddenSupported: countsRes.staffHiddenSupported,
    preparationSummary,
    preparationPacklist,
    dayMatrixPacklist,
    catalog
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
    const productQuantities = body.productQuantities || {};
    const { date: todayBerlin } = getBerlinNow();
    const tomorrowBerlin = tomorrowBerlinDate();
    const pickupDate = String(body.pickupDate || todayBerlin);
    if (pickupDate !== todayBerlin && pickupDate !== tomorrowBerlin) {
      return NextResponse.json({ error: "Manuelle Erfassung ist nur für heute oder morgen möglich." }, { status: 400 });
    }
    const isTomorrow = pickupDate === tomorrowBerlin;
    if (isTomorrow && !customerNameRaw) {
      return NextResponse.json({ error: "Für morgen ist ein Name erforderlich." }, { status: 400 });
    }
    const customerName = customerNameRaw || "Vor-Ort-Verkauf";

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

    const orderId = data?.[0]?.order_id ?? null;
    if (isTomorrow && body.paidNow === true && orderId) {
      const { error: paidErr } = await supabase
        .from("orders")
        .update({ paid_at: new Date().toISOString() })
        .eq("id", orderId)
        .eq("branch_id", branchId);
      if (paidErr && !isMissingPaidAtColumn(paidErr)) {
        return NextResponse.json({ error: paidErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      ok: true,
      orderNumber: data?.[0]?.order_number ?? null,
      orderId
    });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
