import {
  STAFF_ORDER_SELECT,
  STAFF_ORDER_SELECT_WITHOUT_PAID_AT,
  isMissingPaidAtColumn,
  mapOrdersWithSummary
} from "@/lib/staff-orders-shared";

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
  const attempts = [
    { select: STAFF_ORDER_SELECT, staffHiddenSupported: true },
    { select: STAFF_ORDER_SELECT_WITHOUT_PAID_AT, staffHiddenSupported: true },
    { select: selectWithoutStaffHidden(STAFF_ORDER_SELECT), staffHiddenSupported: false },
    { select: selectWithoutStaffHidden(STAFF_ORDER_SELECT_WITHOUT_PAID_AT), staffHiddenSupported: false }
  ];

  let lastError = null;
  for (const attempt of attempts) {
    const result = await queryPickupDay(supabase, { select: attempt.select, branchId, pickupDate });
    if (!result.error) {
      return {
        orders: mapOrdersWithSummary(result.data),
        error: null,
        staffHiddenSupported: attempt.staffHiddenSupported
      };
    }
    lastError = result.error;
    const missingPaid = isMissingPaidAtColumn(result.error);
    const missingHidden = isMissingStaffHiddenColumn(result.error);
    if (!missingPaid && !missingHidden) break;
  }

  return { orders: [], error: lastError, staffHiddenSupported: false };
}

/**
 * @param {object[]} orders
 * @param {boolean} staffHiddenSupported
 */
export function partitionStaffPickupDay(orders, staffHiddenSupported) {
  const visible = staffHiddenSupported ? orders.filter((o) => o.staff_hidden_at == null) : orders;
  const open = visible.filter((o) => o.status === "pending");
  const done = visible.filter((o) => STAFF_DONE_STATUSES.includes(o.status));
  return { open, done, visible };
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
