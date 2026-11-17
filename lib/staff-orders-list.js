import { STAFF_ORDER_SELECT, isMissingPaidAtColumn, mapOrdersWithSummary } from "@/lib/staff-orders-shared";

export const STAFF_DONE_STATUSES = ["delivered", "not_picked_up"];

const STAFF_DAY_STATUSES = ["pending", "delivered", "not_picked_up"];

/** branchId -> Berlin date (YYYY-MM-DD) of the last auto-hide run in this process. */
const autoHideRanOnByBranch = new Map();

function isMissingStaffHiddenColumn(error) {
  if (!error) return false;
  const msg = String(error.message || "");
  return msg.includes("staff_hidden_at");
}

/**
 * At a new Berlin calendar day, hide completed orders from past pickup days on the staff list
 * (same effect as "Erledigte Liste leeren", without deleting rows).
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {{ branchId: number, todayYmd: string }} opts
 */
export async function autoHideDoneOrdersBeforeToday(supabase, { branchId, todayYmd }) {
  const cacheKey = String(branchId);
  if (autoHideRanOnByBranch.get(cacheKey) === todayYmd) {
    return { autoHidden: 0, staffHiddenSupported: true, skipped: true };
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("orders")
    .update({ staff_hidden_at: now })
    .eq("branch_id", branchId)
    .in("status", STAFF_DONE_STATUSES)
    .lt("pickup_date", todayYmd)
    .is("staff_hidden_at", null)
    .select("id");

  if (error && isMissingStaffHiddenColumn(error)) {
    autoHideRanOnByBranch.set(cacheKey, todayYmd);
    return { autoHidden: 0, staffHiddenSupported: false };
  }
  if (error) throw error;

  autoHideRanOnByBranch.set(cacheKey, todayYmd);
  return { autoHidden: (data || []).length, staffHiddenSupported: true };
}

function selectWithoutStaffHidden(select) {
  return select.replace(",staff_hidden_at", "");
}

function isMissingCancelledColumn(error) {
  const msg = String(error?.message || "");
  return msg.includes("cancelled_at") || msg.includes("cancel_reason");
}

function selectWithoutCancelled(select) {
  return select.replace(",cancelled_at,cancel_reason", "");
}

function queryPickupDay(supabase, { select, branchId, pickupDate }) {
  return supabase
    .from("orders")
    .select(select)
    .eq("branch_id", branchId)
    .eq("pickup_date", pickupDate)
    .in("status", STAFF_DAY_STATUSES)
    .order("created_at", { ascending: true });
}

/**
 * One read of the selected pickup day (open, delivered, and not picked up).
 * Hidden rows stay in the result so the pack matrix can still see them.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {{ branchId: number, pickupDate: string }} opts
 */
export async function fetchStaffPickupDayOrders(supabase, { branchId, pickupDate }) {
  let select = STAFF_ORDER_SELECT;
  let staffHiddenSupported = true;
  let lastError = null;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const result = await queryPickupDay(supabase, { select, branchId, pickupDate });
    if (!result.error) {
      return { orders: mapOrdersWithSummary(result.data), error: null, staffHiddenSupported };
    }
    lastError = result.error;
    if (isMissingCancelledColumn(result.error) && select.includes("cancelled_at")) {
      select = selectWithoutCancelled(select);
      continue;
    }
    if (isMissingPaidAtColumn(result.error) && select.includes(",paid_at")) {
      select = select.replace(",paid_at", "");
      continue;
    }
    if (isMissingStaffHiddenColumn(result.error) && select.includes("staff_hidden_at")) {
      select = selectWithoutStaffHidden(select);
      staffHiddenSupported = false;
      continue;
    }
    break;
  }

  return { orders: [], error: lastError, staffHiddenSupported: false };
}

/**
 * @param {object[]} orders
 * @param {boolean} staffHiddenSupported
 */
export function partitionStaffPickupDay(orders, staffHiddenSupported) {
  const cancelled = orders.filter((o) => o.cancelled_at);
  const active = orders.filter((o) => !o.cancelled_at);
  const visible = staffHiddenSupported ? active.filter((o) => o.staff_hidden_at == null) : active;
  const open = visible.filter((o) => o.status === "pending");
  const done = visible.filter((o) => STAFF_DONE_STATUSES.includes(o.status));
  return { open, done, visible, cancelled, active };
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {{ branchId: number, pickupDate: string }} opts
 */
export async function hideDoneOrdersFromStaffList(supabase, { branchId, pickupDate }) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("orders")
    .update({ staff_hidden_at: now })
    .eq("branch_id", branchId)
    .eq("pickup_date", pickupDate)
    .in("status", STAFF_DONE_STATUSES)
    .is("staff_hidden_at", null)
    .select("id");

  if (error && isMissingStaffHiddenColumn(error)) {
    const err = new Error(
      "Datenbank-Migration fehlt (staff_hidden_at). Bitte Migration 20260602150000 ausführen."
    );
    err.status = 503;
    throw err;
  }
  if (error) throw error;

  return { hiddenCount: (data || []).length };
}
