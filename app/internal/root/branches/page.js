import Link from "next/link";
import RootNewBranchForm from "@/components/internal/RootNewBranchForm";
import RootSectionTitle from "@/components/internal/RootSectionTitle";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function RootBranchesPage() {
  const supabase = getSupabaseServerClient();
  const { data: branches } = await supabase
    .from("branches")
    .select("*")
    .order("created_at", { ascending: true });

  const list = branches || [];

  return (
    <div>
      <RootSectionTitle
        title="Standorte"
        subtitle="Neue Filiale anlegen oder bestehende bearbeiten — Slug bestimmt die URL /b/…"
      />

      <div className="space-y-10">
        <RootNewBranchForm />

        <section>
          <h2 className="text-sm font-bold text-slate-900">Alle Standorte</h2>
          <ul className="mt-4 space-y-2">
            {list.map((b) => (
              <li key={b.id}>
                <Link href={`/internal/root/branches/${b.id}`} className="fb-list-item">
                  <span className="font-medium text-slate-900">{b.name}</span>
                  <span className="text-slate-500">
                    /b/{b.slug}
                    {b.is_active ? "" : " · inaktiv"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {!list.length ? <div className="fb-empty mt-4">Noch keine Standorte angelegt.</div> : null}
        </section>
      </div>
    </div>
  );
}
