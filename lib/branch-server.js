import { getSupabaseServerClient } from "@/lib/supabase";
import { normalizeBranchSlug } from "@/lib/internal-session";

/**
 * @returns {Promise<{ error: string | null, branch: { id: number, name: string, slug: string, is_active: boolean } | null }>}
 */
export async function fetchBranchBySlug(slug) {
  const s = normalizeBranchSlug(slug);
  if (!s) return { error: "invalid_slug", branch: null };
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("branches").select("id,name,slug,is_active").eq("slug", s).maybeSingle();
  if (error) return { error: error.message, branch: null };
  if (!data?.is_active) return { error: "not_found", branch: null };
  return { error: null, branch: data };
}
