import Link from "next/link";
import { notFound } from "next/navigation";
import BranchAppChrome from "@/components/BranchAppChrome";
import { fetchBranchBySlug } from "@/lib/branch-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BranchLandingPage({ params }) {
  const { branch, error } = await fetchBranchBySlug(params.slug);
  if (error || !branch) notFound();

  const slug = branch.slug;

  return (
    <div className="fb-page-order">
      <BranchAppChrome branchSlug={slug} branchName={branch.name} />
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="fb-hero text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/75">Standort</p>
          <h1 className="mt-2 text-xl font-bold leading-tight text-white sm:text-2xl">{branch.name}</h1>
          <p className="mt-3 text-sm leading-relaxed text-white/90">Bitte wählen Sie eine Option.</p>
        </div>
        <div className="flex flex-col gap-3 sm:gap-4">
          <Link
            href={`/b/${slug}/order`}
            className="fb-btn-primary inline-flex min-h-[3.25rem] items-center justify-center px-6 py-4 text-center text-base font-bold shadow-md sm:min-h-[3.5rem] sm:text-lg"
          >
            Frühstück bestellen
          </Link>
          <Link
            href={`/b/${slug}/register`}
            className="fb-btn-primary inline-flex min-h-[3.25rem] items-center justify-center px-6 py-4 text-center text-base font-bold shadow-md sm:min-h-[3.5rem] sm:text-lg"
          >
            Registrieren
          </Link>
        </div>
      </div>
      <footer className="mt-10 border-t border-slate-200/80 pt-4 text-center text-xs leading-relaxed text-slate-500">
        <p className="font-medium text-slate-600/90">{branch.name}</p>
        <p>Service wählen</p>
      </footer>
    </div>
  );
}
