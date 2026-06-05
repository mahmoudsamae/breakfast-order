/**
 * Active products/menus for staff Vor-Ort and repeat-order flows.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {number} branchId
 */
export async function fetchStaffCatalog(supabase, branchId) {
  const [{ data: productsData, error: productsErr }, { data: menusData, error: menusErr }] = await Promise.all([
    supabase
      .from("products")
      .select("id,name,price,category,image_url,is_active")
      .eq("branch_id", branchId)
      .eq("category", "backwaren")
      .eq("is_active", true)
      .is("archived_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("menus")
      .select("id,name,price,image_url,is_active")
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .is("archived_at", null)
      .order("name", { ascending: true })
  ]);

  return {
    catalog: {
      products: productsData || [],
      menus: menusData || []
    },
    error: productsErr || menusErr
  };
}
