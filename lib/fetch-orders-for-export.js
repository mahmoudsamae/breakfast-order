/** Matches PostgREST default page size — one request must not exceed this. */
export const ORDERS_EXPORT_PAGE_SIZE = 1000;

/** Hard cap so a runaway export cannot exhaust server memory (≈50k orders). */
export const ORDERS_EXPORT_MAX_ORDERS = 50_000;

const ORDER_SELECT_FOR_EXPORT = "*,order_items(quantity,products(name),menus(name))";

/**
 * Load all orders (with line items) for Excel export using paginated Supabase queries.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {{ branchId?: number | null }} [options]
 * @returns {Promise<{ orders: object[], fetchedPages: number }>}
 */
export async function fetchAllOrdersForExport(supabase, options = {}) {
  const { branchId = null } = options;
  const all = [];
  let from = 0;
  let fetchedPages = 0;

  while (true) {
    let query = supabase
      .from("orders")
      .select(ORDER_SELECT_FOR_EXPORT)
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
        `Export-Limit erreicht (max. ${ORDERS_EXPORT_MAX_ORDERS.toLocaleString("de-DE")} Bestellungen). Bitte einen kürzeren Zeitraum wählen oder Support kontaktieren.`
      );
      err.code = "EXPORT_LIMIT";
      throw err;
    }
    all.push(...batch);
    fetchedPages += 1;

    if (batch.length < ORDERS_EXPORT_PAGE_SIZE) {
      return { orders: all, fetchedPages };
    }

    from += ORDERS_EXPORT_PAGE_SIZE;
  }
}
