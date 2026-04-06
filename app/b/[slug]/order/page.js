import { notFound } from "next/navigation";
import BranchAppChrome from "@/components/BranchAppChrome";
import OrderClient from "@/components/OrderClient";
import { fetchBranchBySlug } from "@/lib/branch-server";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BranchOrderPage({ params }) {
  const { branch, error } = await fetchBranchBySlug(params.slug);
  if (error || !branch) notFound();

  const supabase = getSupabaseServerClient();
  const branchId = branch.id;
  const [{ data: products, error: productsError }, { data: menus, error: menusError }] = await Promise.all([
    supabase.from("products").select("id,name,price,image_url,is_active,category").eq("branch_id", branchId).eq("is_active", true).order("id"),
    supabase.from("menus").select("id,name,description,price,image_url,is_active").eq("branch_id", branchId).eq("is_active", true).order("id")
  ]);

  const loadError = [productsError?.message, menusError?.message].filter(Boolean).join(" · ");
  const slug = branch.slug;

  return (
    <div className="fb-page-order">
      <BranchAppChrome branchSlug={slug} branchName={branch.name} />
      <OrderClient
        products={products || []}
        menus={menus || []}
        loadError={loadError || ""}
        branchSlug={slug}
        orderApiPath={`/api/branches/${slug}/orders`}
        branchDisplayName={branch.name}
      />
      <footer className="mt-10 border-t border-slate-200/80 pt-4 text-center text-xs leading-relaxed text-slate-500">
        <p className="font-medium text-slate-600/90">{branch.name}</p>
        <p>Digitale Frühstücksbestellung</p>
      </footer>
    </div>
  );
}
