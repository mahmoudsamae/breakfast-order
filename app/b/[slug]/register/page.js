import { Suspense } from "react";
import { notFound } from "next/navigation";
import BranchAppChrome from "@/components/BranchAppChrome";
import RegisterClient from "@/components/RegisterClient";
import { fetchBranchBySlug } from "@/lib/branch-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BranchRegisterPage({ params }) {
  const { branch, error } = await fetchBranchBySlug(params.slug);
  if (error || !branch) notFound();

  const slug = branch.slug;

  return (
    <div className="fb-page-order">
      <BranchAppChrome branchSlug={slug} branchName={branch.name} />
      <div className="mb-6">
        <div className="fb-hero">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/75">Aufenthalt</p>
          <h1 className="mt-2 text-xl font-bold leading-tight text-white sm:text-2xl">Registrieren</h1>
          <p className="mt-2 text-sm leading-snug text-white/90">{branch.name} — Anmeldung für Ihren Aufenthalt.</p>
        </div>
      </div>
      <Suspense fallback={<p className="text-sm text-slate-500">Laden…</p>}>
        <RegisterClient branchSlug={slug} branchName={branch.name} />
      </Suspense>
      <footer className="mt-10 border-t border-slate-200/80 pt-4 text-center text-xs leading-relaxed text-slate-500">
        <p className="font-medium text-slate-600/90">{branch.name}</p>
        <p>Separat von der Frühstücksbestellung</p>
      </footer>
    </div>
  );
}
