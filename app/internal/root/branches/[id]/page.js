import { notFound } from "next/navigation";
import RootBranchEditor from "@/components/internal/RootBranchEditor";
import RootSectionTitle from "@/components/internal/RootSectionTitle";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function RootBranchDetailPage({ params }) {
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0 || !Number.isInteger(id)) notFound();

  const supabase = getSupabaseServerClient();
  const { data: branch } = await supabase.from("branches").select("*").eq("id", id).maybeSingle();
  if (!branch) notFound();

  const { data: credentials } = await supabase
    .from("branch_credentials")
    .select("id,branch_id,username,role,is_active,created_at")
    .eq("branch_id", id)
    .order("username", { ascending: true });

  const [ordersCt, productsCt, menusCt, credsCt] = await Promise.all([
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("branch_id", id),
    supabase.from("products").select("*", { count: "exact", head: true }).eq("branch_id", id),
    supabase.from("menus").select("*", { count: "exact", head: true }).eq("branch_id", id),
    supabase.from("branch_credentials").select("*", { count: "exact", head: true }).eq("branch_id", id)
  ]);

  const dangerStats = {
    orders: ordersCt.count ?? 0,
    products: productsCt.count ?? 0,
    menus: menusCt.count ?? 0,
    credentials: credsCt.count ?? 0
  };

  return (
    <div>
      <RootSectionTitle
        title={branch.name}
        subtitle="Standort bearbeiten, Team-/Admin-Konten verwalten, oder den Standort deaktivieren bzw. endgültig entfernen."
      />
      <RootBranchEditor
        branchId={String(id)}
        initialBranch={branch}
        initialCredentials={credentials || []}
        dangerStats={dangerStats}
      />
    </div>
  );
}
