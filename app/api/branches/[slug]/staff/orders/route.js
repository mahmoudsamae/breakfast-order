import { NextResponse } from "next/server";
import { requireBranchSession } from "@/lib/api-branch-guard";
import { fetchBranchBySlug } from "@/lib/branch-server";
import { getGuestOrdersPaused } from "@/lib/guest-orders-paused";
import { recordOrderEvent } from "@/lib/order-events";
import { getSupabaseServerClient } from "@/lib/supabase";
import { fetchStaffCatalog } from "@/lib/staff-catalog";
import { getBerlinNow, MAX_QTY_PER_ITEM, tomorrowBerlinDate } from "@/lib/order-utils";
import {
  autoHideDoneOrdersBeforeToday,
  fetchStaffPickupDayOrders,
  partitionStaffPickupDay
} from "@/lib/staff-orders-list";
import {
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

  const { orders: dayOrders, error: dayErr, staffHiddenSupported } = await fetchStaffPickupDayOrders(supabase, {
    branchId,
    pickupDate
  });
  if (dayErr) return NextResponse.json({ error: dayErr.message }, { status: 500 });

  const { open, done, visible, cancelled, active } = partitionStaffPickupDay(dayOrders, staffHiddenSupported);
  const normalizedProducts = packlistProductsFromOrders(open);
  const preparationSummary = {
    products: normalizedProducts,
    menus: menuTotalsFromOrders(open)
  };
  const dayMatrixPacklist = packlistProductsFromOrders(active);
  const { paused: guestOrdersPaused } = await getGuestOrdersPaused(supabase, branchId);

  return NextResponse.json({
    orders: visible,
    cancelledOrders: cancelled,
    pickupDate,
    counts: {
      open: open.length,
      done: done.length,
      cancelled: cancelled.length
    },
    staffHiddenSupported,
    preparationSummary,
    preparationPacklist: normalizedProducts,
    dayMatrixPacklist,
    catalog,
    guestOrdersPaused
  });
}

export async function POST(req, { params }) {
  const { error: authErr, session } = await requireBranchSession(params.slug, ["team", "admin"]);
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
    await recordOrderEvent(supabase, {
      orderId,
      branchId,
      action: "create",
      role: session.role,
      details: { pickupDate, orderNumber: data?.[0]?.order_number ?? null }
    });
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
