import { NextResponse } from "next/server";

function isMissingRelation(error, name) {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return String(error.message || "").includes(name);
}

/** Writes one audit row. A missing table does not fail the order action. */
export async function recordOrderEvent(supabase, { orderId = null, branchId, action, role, details = null }) {
  const { error } = await supabase.from("order_events").insert({
    order_id: orderId,
    branch_id: branchId,
    action,
    role: role || null,
    details
  });
  if (!error) return;
  if (isMissingRelation(error, "order_events")) return;
  throw error;
}

/** Blocks changes to a cancelled order. Returns a response, or null when the order may proceed. */
export async function rejectIfCancelled(supabase, { id, branchId }) {
  const { data, error } = await supabase
    .from("orders")
    .select("cancelled_at")
    .eq("id", id)
    .eq("branch_id", branchId)
    .maybeSingle();
  if (error) {
    if (isMissingRelation(error, "cancelled_at") || String(error.message || "").includes("cancelled_at")) return null;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Bestellung nicht gefunden." }, { status: 404 });
  if (data.cancelled_at) {
    return NextResponse.json({ error: "Diese Bestellung ist storniert." }, { status: 409 });
  }
  return null;
}
