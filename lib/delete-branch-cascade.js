/**
 * Hard-delete a branch and all dependent rows (orders, catalog, counters).
 * branch_credentials are removed via ON DELETE CASCADE on public.branches.
 * Storage bucket images may remain orphaned — clean separately if needed.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {number} branchId
 */
export async function deleteBranchCascade(supabase, branchId) {
  const { data: orders, error: ordersErr } = await supabase.from("orders").select("id").eq("branch_id", branchId);
  if (ordersErr) throw new Error(ordersErr.message);

  const orderIds = (orders || []).map((o) => o.id);
  if (orderIds.length > 0) {
    const { error: oiErr } = await supabase.from("order_items").delete().in("order_id", orderIds);
    if (oiErr) throw new Error(oiErr.message);
  }

  const { error: ordErr } = await supabase.from("orders").delete().eq("branch_id", branchId);
  if (ordErr) throw new Error(ordErr.message);

  const { error: menuErr } = await supabase.from("menus").delete().eq("branch_id", branchId);
  if (menuErr) throw new Error(menuErr.message);

  const { error: prodErr } = await supabase.from("products").delete().eq("branch_id", branchId);
  if (prodErr) throw new Error(prodErr.message);

  const { error: ctrErr } = await supabase.from("daily_order_counters").delete().eq("branch_id", branchId);
  if (ctrErr) throw new Error(ctrErr.message);

  const { error: brErr } = await supabase.from("branches").delete().eq("id", branchId);
  if (brErr) throw new Error(brErr.message);
}
