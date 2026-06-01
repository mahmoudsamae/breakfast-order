import { unstable_noStore as noStore } from "next/cache";
import HomePageClient from "@/components/HomePageClient";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  noStore();
  const supabase = getSupabaseServerClient();
  const { data: branches, error } = await supabase
    .from("branches")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  return <HomePageClient branches={error ? [] : branches || []} loadError={error?.message || ""} />;
}
