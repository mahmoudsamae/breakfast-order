export const GUEST_ORDERS_PAUSED_CODE = "GUEST_ORDERS_PAUSED";

export const GUEST_ORDERS_PAUSED_MESSAGE = "Gastbestellungen sind derzeit geschlossen.";

/** Default German guest copy (editable in admin when pausing). */
export const DEFAULT_GUEST_ORDERS_PAUSED_BODY =
  "Heute können keine Bestellungen mehr aufgegeben werden.";

export function isMissingGuestOrdersPausedColumn(error) {
  if (!error) return false;
  const msg = String(error.message || "");
  if (error.code === "42703") return msg.includes("guest_orders_paused");
  return msg.includes("guest_orders_paused");
}

export function isMissingGuestOrdersPausedMessageColumn(error) {
  if (!error) return false;
  const msg = String(error.message || "");
  if (error.code === "42703") return msg.includes("guest_orders_paused_message");
  return msg.includes("guest_orders_paused_message");
}

/**
 * @returns {Promise<{ paused: boolean, message: string | null, missingColumn: boolean }>}
 */
export async function getGuestOrdersPaused(supabase, branchId) {
  if (branchId == null) return { paused: false, message: null, missingColumn: false };

  const withMessage = await supabase
    .from("branches")
    .select("guest_orders_paused, guest_orders_paused_message")
    .eq("id", branchId)
    .maybeSingle();

  if (!withMessage.error) {
    return {
      paused: Boolean(withMessage.data?.guest_orders_paused),
      message: String(withMessage.data?.guest_orders_paused_message || "").trim() || null,
      missingColumn: false
    };
  }

  if (isMissingGuestOrdersPausedMessageColumn(withMessage.error)) {
    const flagOnly = await supabase
      .from("branches")
      .select("guest_orders_paused")
      .eq("id", branchId)
      .maybeSingle();
    if (flagOnly.error) {
      if (isMissingGuestOrdersPausedColumn(flagOnly.error)) {
        return { paused: false, message: null, missingColumn: true };
      }
      return { paused: false, message: null, missingColumn: false };
    }
    return {
      paused: Boolean(flagOnly.data?.guest_orders_paused),
      message: null,
      missingColumn: false
    };
  }

  if (isMissingGuestOrdersPausedColumn(withMessage.error)) {
    return { paused: false, message: null, missingColumn: true };
  }
  return { paused: false, message: null, missingColumn: false };
}

/**
 * @param {boolean} paused
 * @param {string | null | undefined} message — guest message when pausing; ignored when opening
 */
export async function setGuestOrdersPaused(supabase, branchId, paused, message) {
  const nextPaused = Boolean(paused);
  const patch = { guest_orders_paused: nextPaused };

  if (nextPaused) {
    const cleaned = String(message ?? "").trim();
    patch.guest_orders_paused_message = cleaned || DEFAULT_GUEST_ORDERS_PAUSED_BODY;
  }

  let { error } = await supabase.from("branches").update(patch).eq("id", branchId);

  if (error && isMissingGuestOrdersPausedMessageColumn(error) && nextPaused) {
    const retry = await supabase
      .from("branches")
      .update({ guest_orders_paused: true })
      .eq("id", branchId);
    error = retry.error;
  }

  if (error) {
    if (isMissingGuestOrdersPausedColumn(error)) {
      const err = new Error(
        "guest_orders_paused Migration fehlt. Bitte 20261025120000_add_branches_guest_orders_paused.sql ausführen."
      );
      err.status = 503;
      err.missingColumn = true;
      throw err;
    }
    if (isMissingGuestOrdersPausedMessageColumn(error)) {
      const err = new Error(
        "guest_orders_paused_message Migration fehlt. Bitte 20261025130000_add_guest_orders_paused_message.sql ausführen."
      );
      err.status = 503;
      err.missingColumn = true;
      throw err;
    }
    const err = new Error(error.message || "Status konnte nicht gespeichert werden.");
    err.status = 500;
    throw err;
  }

  return {
    paused: nextPaused,
    message: nextPaused ? String(patch.guest_orders_paused_message || "").trim() || null : null
  };
}
