import Link from "next/link";
import RootSectionTitle from "@/components/internal/RootSectionTitle";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function RootUsersPage() {
  const supabase = getSupabaseServerClient();
  const { data: rows } = await supabase
    .from("branch_credentials")
    .select("id,branch_id,username,role,is_active,created_at, branches(name,slug)")
    .order("branch_id", { ascending: true })
    .order("username", { ascending: true });

  const list = rows || [];

  return (
    <div>
      <RootSectionTitle
        title="Branch-Konten"
        subtitle="Alle Team- und Admin-Zugänge je Standort. Bearbeitung in der jeweiligen Standort-Detailseite."
      />

      <div className="fb-table-wrap">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr>
              <th className="fb-th">Standort</th>
              <th className="fb-th">Benutzername</th>
              <th className="fb-th">Rolle</th>
              <th className="fb-th">Status</th>
              <th className="fb-th" />
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const b = r.branches;
              const name = b?.name ?? "—";
              const slug = b?.slug ?? "";
              return (
                <tr key={r.id} className="border-b border-slate-100 last:border-0">
                  <td className="fb-td text-slate-900">
                    {name}
                    {slug ? <span className="ml-2 text-slate-500">/b/{slug}</span> : null}
                  </td>
                  <td className="fb-td font-mono text-slate-800">{r.username}</td>
                  <td className="fb-td text-slate-700">{r.role}</td>
                  <td className="fb-td text-slate-700">{r.is_active ? "aktiv" : "deaktiviert"}</td>
                  <td className="fb-td">
                    {r.branch_id ? (
                      <Link
                        href={`/internal/root/branches/${r.branch_id}`}
                        className="font-medium text-amber-800 hover:underline"
                      >
                        Bearbeiten
                      </Link>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!list.length ? <div className="fb-empty mt-6">Keine Konten angelegt.</div> : null}
    </div>
  );
}
