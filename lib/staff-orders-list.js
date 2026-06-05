import {
  STAFF_ORDER_SELECT,
  STAFF_ORDER_SELECT_WITHOUT_PAID_AT,
  isMissingPaidAtColumn,
  mapOrdersWithSummary
} from "@/lib/staff-orders-shared";

export const STAFF_DONE_STATUSES = ["delivered", "not_picked_up"];

function isMissingStaffHiddenColumn(error) {
  if (!error) return false;
  const msg = String(error.message || "");
  return msg.includes("staff_hidden_at");
}

async function runStaffOrdersSelect(supabase, { select, branchId, pickupDate, listMode, useStaffHiddenFilter }) {
  let query = supabase
    .from("orders")
    .select(select)
    .eq("branch_id", branchId)
    .eq("pickup_date", pickupDate)
    .order("created_at", { ascending: true });

  if (listMode === "done") {
    query = query.in("status", STAFF_DONE_STATUSES);
  } else if (listMode === "open") {
    query = query.eq("status", "pending");
  }

  if (useStaffHiddenFilter) {
    query = query.is("staff_hidden_at", null);
  }

  return query;
}

async function fetchStaffOrdersWithFallback(supabase, { branchId, pickupDate, listMode }) {
  let staffHiddenSupported = true;
  let select = STAFF_ORDER_SELECT;
  let result = await runStaffOrdersSelect(supabase, {
    select,
    branchId,
    pickupDate,
    listMode,
    useStaffHiddenFilter: true
  });

  if (result.error && isMissingPaidAtColumn(result.error)) {
    select = STAFF_ORDER_SELECT_WITHOUT_PAID_AT;
    result = await runStaffOrdersSelect(supabase, {
      select,
      branchId,
      pickupDate,
      listMode,
      useStaffHiddenFilter: true
    });
  }

  if (result.error && isMissingStaffHiddenColumn(result.error)) {
    staffHiddenSupported = false;
    result = await runStaffOrdersSelect(supabase, {
      select,
      branchId,
      pickupDate,
      listMode,
      useStaffHiddenFilter: false
    });
  }

  if (result.error && isMissingPaidAtColumn(result.error)) {
    select = STAFF_ORDER_SELECT_WITHOUT_PAID_AT;
    result = await runStaffOrdersSelect(supabase, {
      select,
      branchId,
      pickupDate,
      listMode,
      useStaffHiddenFilter: staffHiddenSupported
    });
  }

  return { ...result, staffHiddenSupported };
}

/**
 * At a new Berlin calendar day, hide completed orders from past pickup days on the staff list
 * (same effect as "Erledigte Liste leeren", without deleting rows).
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {{ branchId: number, todayYmd: string }} opts
 */
export async function autoHideDoneOrdersBeforeToday(supabase, { branchId, todayYmd }) {
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
    return { autoHidden: 0, staffHiddenSupported: false };
  }
  if (error) throw error;

  return { autoHidden: (data || []).length, staffHiddenSupported: true };
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {{ branchId: number, pickupDate: string, listMode: "open" | "done" }} opts
 */
export async function fetchStaffOrdersForList(supabase, { branchId, pickupDate, listMode }) {
  const { data, error, staffHiddenSupported } = await fetchStaffOrdersWithFallback(supabase, {
    branchId,
    pickupDate,
    listMode
  });
  return { orders: mapOrdersWithSummary(data), error, staffHiddenSupported };
}

/** Day matrix: pending + delivered + not_picked_up for one pickup date. */
export async function fetchStaffDayMatrixOrders(supabase, { branchId, pickupDate }) {
  let staffHiddenSupported = true;
  let select = STAFF_ORDER_SELECT;
  let query = supabase
    .from("orders")
    .select(select)
    .eq("branch_id", branchId)
    .eq("pickup_date", pickupDate)
    .in("status", ["pending", "delivered", "not_picked_up"])
    .order("created_at", { ascending: true });

  let result = await query;
  if (result.error && isMissingPaidAtColumn(result.error)) {
    select = STAFF_ORDER_SELECT_WITHOUT_PAID_AT;
    result = await supabase
      .from("orders")
      .select(select)
      .eq("branch_id", branchId)
      .eq("pickup_date", pickupDate)
      .in("status", ["pending", "delivered", "not_picked_up"])
      .order("created_at", { ascending: true });
  }

  return { data: result.data, error: result.error, staffHiddenSupported };
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {{ branchId: number, pickupDate: string }} opts
 */
export async function fetchStaffOrderListCounts(supabase, { branchId, pickupDate }) {
  async function countFor(mode) {
    let query = supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", branchId)
      .eq("pickup_date", pickupDate);

    if (mode === "done") {
      query = query.in("status", STAFF_DONE_STATUSES);
    } else {
      query = query.eq("status", "pending");
    }

    let result = await query.is("staff_hidden_at", null);
    if (result.error && isMissingStaffHiddenColumn(result.error)) {
      let fallback = supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("branch_id", branchId)
        .eq("pickup_date", pickupDate);
      if (mode === "done") {
        fallback = fallback.in("status", STAFF_DONE_STATUSES);
      } else {
        fallback = fallback.eq("status", "pending");
      }
      result = await fallback;
    }
    return result;
  }

  const [openRes, doneRes] = await Promise.all([countFor("open"), countFor("done")]);
  return {
    openCount: openRes.count ?? 0,
    doneCount: doneRes.count ?? 0,
    error: openRes.error || doneRes.error,
    staffHiddenSupported: !(
      isMissingStaffHiddenColumn(openRes.error) || isMissingStaffHiddenColumn(doneRes.error)
    )
  };
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
