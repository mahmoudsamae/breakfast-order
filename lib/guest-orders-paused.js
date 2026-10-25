export const GUEST_ORDERS_PAUSED_CODE = "GUEST_ORDERS_PAUSED";

export const GUEST_ORDERS_PAUSED_MESSAGE = "Gastbestellungen sind derzeit geschlossen.";

export function isMissingGuestOrdersPausedColumn(error) {
  if (!error) return false;
  const msg = String(error.message || "");
  if (error.code === "42703") return msg.includes("guest_orders_paused");
  return msg.includes("guest_orders_paused");
}

/**
 * Guest pause flag for one branch. Missing column or read errors → not paused (do not break ordering).
 * @returns {Promise<{ paused: boolean, missingColumn: boolean }>}
 */
export async function getGuestOrdersPaused(supabase, branchId) {
  if (branchId == null) return { paused: false, missingColumn: false };
  const { data, error } = await supabase
    .from("branches")
    .select("guest_orders_paused")
    .eq("id", branchId)
    .maybeSingle();

  if (error) {
    if (isMissingGuestOrdersPausedColumn(error)) return { paused: false, missingColumn: true };
    return { paused: false, missingColumn: false };
  }
  return { paused: Boolean(data?.guest_orders_paused), missingColumn: false };
}

export async function setGuestOrdersPaused(supabase, branchId, paused) {
  const { error } = await supabase
    .from("branches")
    .update({ guest_orders_paused: Boolean(paused) })
    .eq("id", branchId);

  if (error) {
    if (isMissingGuestOrdersPausedColumn(error)) {
      const err = new Error(
        "guest_orders_paused Migration fehlt. Bitte 20261025120000_add_branches_guest_orders_paused.sql ausführen."
      );
      err.status = 503;
      err.missingColumn = true;
      throw err;
    }
    const err = new Error(error.message || "Status konnte nicht gespeichert werden.");
    err.status = 500;
    throw err;
  }
  return { paused: Boolean(paused) };
}
