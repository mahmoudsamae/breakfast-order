import RootChangePasswordForm from "@/components/internal/RootChangePasswordForm";
import RootSectionTitle from "@/components/internal/RootSectionTitle";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function RootDashboardPage() {
  const supabase = getSupabaseServerClient();
  const [{ count: branchCount }, { count: credCount }] = await Promise.all([
    supabase.from("branches").select("*", { count: "exact", head: true }),
    supabase.from("branch_credentials").select("*", { count: "exact", head: true })
  ]);

  return (
    <div>
      <RootSectionTitle
        title="Übersicht"
        subtitle="Standorte und Branch-Konten verwalten — gleiche Oberfläche wie die Team-Ansichten, zentral für den Betrieb."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="fb-hero">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/75">Standorte</p>
          <p className="mt-2 text-3xl font-black tabular-nums text-white">{branchCount ?? "—"}</p>
          <p className="mt-1 text-xs text-white/85">Registrierte Filialen (aktiv + inaktiv)</p>
        </div>
        <div className="fb-hero">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/75">Branch-Konten</p>
          <p className="mt-2 text-3xl font-black tabular-nums text-white">{credCount ?? "—"}</p>
          <p className="mt-1 text-xs text-white/85">Team- und Admin-Logins über alle Standorte</p>
        </div>
      </div>

      <div className="mt-10">
        <RootChangePasswordForm />
      </div>
    </div>
  );
}
