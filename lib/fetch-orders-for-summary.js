import { ORDERS_EXPORT_MAX_ORDERS, ORDERS_EXPORT_PAGE_SIZE } from "@/lib/fetch-orders-for-export";

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
 * @param {{ branchId?: number | null }} [options]
 */
async function fetchOrdersPaginated(supabase, select, options = {}) {
  const { branchId = null } = options;
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

/**
 * All orders + line items for admin summary (paginated; avoids 1000-row cap).
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {{ branchId?: number | null }} [options]
 * @returns {Promise<{ orders: object[], items: object[] }>}
 */
export async function fetchOrdersAndItemsForSummary(supabase, options = {}) {
  const { branchId = null } = options;

  let orders;
  try {
    orders = await fetchOrdersPaginated(supabase, SUMMARY_ORDERS_SELECT_WITH_REASONS, { branchId });
  } catch (e) {
    if (!isMissingReasonColumnsError(e)) throw e;
    orders = await fetchOrdersPaginated(supabase, SUMMARY_ORDERS_SELECT_FALLBACK, { branchId });
    orders = orders.map((o) => ({
      ...o,
      not_picked_up_reason: null,
      not_picked_up_note: ""
    }));
  }

  const orderIds = orders.map((o) => o.id).filter((id) => id != null);
  const items = await fetchOrderItemsForOrderIds(supabase, orderIds);

  return { orders, items };
}
