import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
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

  const list = error ? [] : branches || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/80 to-slate-50">
      <div className="fb-page-narrow">
        <div className="fb-hero mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/75">Frühstück</p>
          <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Bestellen</h1>
          <p className="mt-2 text-sm text-white/90">Standort wählen — wie an der Theke, nur digital.</p>
        </div>

        <ul className="space-y-2">
          {list.map((b) => (
            <li key={String(b.id)}>
              <Link href={`/b/${b.slug}`} className="fb-list-item font-medium">
                {b.name}
              </Link>
            </li>
          ))}
        </ul>
        {error ? (
          <p className="fb-alert-error mt-6">Standorte konnten nicht geladen werden ({error.message}).</p>
        ) : null}
        {!error && !list.length ? (
          <div className="fb-empty mt-6">Keine aktiven Standorte in der Datenbank.</div>
        ) : null}
      </div>
    </div>
  );
}
