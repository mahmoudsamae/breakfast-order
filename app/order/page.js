import AppChrome from "@/components/AppChrome";
import OrderClient from "@/components/OrderClient";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OrderPage() {
  const supabase = getSupabaseServerClient();
  const [{ data: products, error: productsError }, { data: menus, error: menusError }] = await Promise.all([
    supabase.from("products").select("id,name,price,image_url,is_active,category").eq("is_active", true).order("id"),
    supabase.from("menus").select("id,name,description,price,image_url,is_active").eq("is_active", true).order("id")
  ]);

  const error = [productsError?.message, menusError?.message].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto min-h-screen w-full max-w-4xl px-4 pb-[max(8.5rem,env(safe-area-inset-bottom,0px)+6.5rem)] pt-4 sm:pt-5 md:pb-36 md:pt-6">
      <AppChrome />
      <OrderClient products={products || []} menus={menus || []} loadError={error || ""} />
    </div>
  );
}
