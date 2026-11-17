import { ORDERS_EXPORT_MAX_ORDERS, ORDERS_EXPORT_PAGE_SIZE } from "@/lib/fetch-orders-for-export";
import { berlinDateFromIso } from "@/lib/order-utils";

export const SUMMARY_ORDERS_SELECT_WITH_REASONS =
  "id,order_number,customer_name,created_at,total_amount,status,delivered_at,pickup_date,not_picked_up_reason,not_picked_up_note";

export const SUMMARY_ORDERS_SELECT_FALLBACK =
  "id,order_number,customer_name,created_at,total_amount,status,delivered_at,pickup_date";

const SUMMARY_ORDER_ITEMS_SELECT = "order_id,quantity,unit_price,product_id,menu_id,products(name),menus(name)";

/** PostgREST `.in()` URL size — keep chunks modest. */
const ORDER_IDS_IN_CHUNK = 200;

function isMissingReasonColumnsError(error) {
  if (!error) return false;
  if (error.code === "42703") return true;
  const msg = String(error.message || "");
  return msg.includes("not_picked_up_reason") || msg.includes("not_picked_up_note");
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} select
 * @param {{ branchId?: number | null, orFilter?: string | null }} [options]
 */
async function fetchOrdersPaginated(supabase, select, options = {}) {
  const { branchId = null, orFilter = null } = options;
  const all = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from("orders")
      .select(select)
      .order("created_at", { ascending: true })
      .range(from, from + ORDERS_EXPORT_PAGE_SIZE - 1);

    if (branchId != null) {
      query = query.eq("branch_id", branchId);
    }
    if (orFilter) {
      query = query.or(orFilter);
    }

    const { data, error } = await query;
    if (error) throw error;

    const batch = data || [];
    if (all.length + batch.length > ORDERS_EXPORT_MAX_ORDERS) {
      const err = new Error(
        `Analyse-Limit erreicht (max. ${ORDERS_EXPORT_MAX_ORDERS.toLocaleString("de-DE")} Bestellungen).`
      );
      err.code = "SUMMARY_LIMIT";
      throw err;
    }

    all.push(...batch);
    if (batch.length < ORDERS_EXPORT_PAGE_SIZE) {
      return all;
    }
    from += ORDERS_EXPORT_PAGE_SIZE;
  }
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {number[]} orderIds
 */
async function fetchOrderItemsForOrderIds(supabase, orderIds) {
  if (!orderIds.length) return [];

  const all = [];
  for (let i = 0; i < orderIds.length; i += ORDER_IDS_IN_CHUNK) {
    const chunk = orderIds.slice(i, i + ORDER_IDS_IN_CHUNK);
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from("order_items")
        .select(SUMMARY_ORDER_ITEMS_SELECT)
        .in("order_id", chunk)
        .range(from, from + ORDERS_EXPORT_PAGE_SIZE - 1);

      if (error) throw error;

      const batch = data || [];
      all.push(...batch);
      if (batch.length < ORDERS_EXPORT_PAGE_SIZE) break;
      from += ORDERS_EXPORT_PAGE_SIZE;
    }
  }

  return all;
}

function summaryOrFilter({ windowStartIso, pendingPickupDate }) {
  if (!windowStartIso) return null;
  const quoted = `"${windowStartIso}"`;
  const parts = [`created_at.gte.${quoted}`, `delivered_at.gte.${quoted}`];
  if (pendingPickupDate) {
    parts.push(`and(status.eq.pending,pickup_date.eq.${pendingPickupDate})`);
  }
  return parts.join(",");
}

/**
 * Orders + line items for the Verwaltung summary.
 * Without a window this still walks the whole branch (Excel-style callers).
 * With windowStartYmd, `orders` are those placed on or after that Berlin day.
 * `supplementalOrders` were placed earlier but were delivered in the window or are still open for today's pickup.
 * Line items are loaded only for `orders`.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {{ branchId?: number | null, windowStartIso?: string | null, windowStartYmd?: string | null, pendingPickupDate?: string | null }} [options]
 * @returns {Promise<{ orders: object[], supplementalOrders: object[], items: object[] }>}
 */
export async function fetchOrdersAndItemsForSummary(supabase, options = {}) {
  const { branchId = null, windowStartIso = null, windowStartYmd = null, pendingPickupDate = null } = options;
  const pageOptions = {
    branchId,
    orFilter: summaryOrFilter({ windowStartIso, pendingPickupDate })
  };

  let orders;
  try {
    orders = await fetchOrdersPaginated(supabase, SUMMARY_ORDERS_SELECT_WITH_REASONS, pageOptions);
  } catch (e) {
    if (!isMissingReasonColumnsError(e)) throw e;
    orders = await fetchOrdersPaginated(supabase, SUMMARY_ORDERS_SELECT_FALLBACK, pageOptions);
    orders = orders.map((o) => ({
      ...o,
      not_picked_up_reason: null,
      not_picked_up_note: ""
    }));
  }

  let inWindow = orders;
  let supplementalOrders = [];
  if (windowStartYmd) {
    inWindow = [];
    for (const order of orders) {
      const createdDay = berlinDateFromIso(order.created_at);
      if (createdDay && createdDay >= windowStartYmd) inWindow.push(order);
      else supplementalOrders.push(order);
    }
  }

  const orderIds = inWindow.map((o) => o.id).filter((id) => id != null);
  const items = await fetchOrderItemsForOrderIds(supabase, orderIds);

  return { orders: inWindow, supplementalOrders, items };
}
