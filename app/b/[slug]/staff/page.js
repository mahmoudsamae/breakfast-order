import Link from "next/link";
import BranchAppChrome from "@/components/BranchAppChrome";
import StaffClient from "@/components/StaffClient";
import { fetchBranchBySlug } from "@/lib/branch-server";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BranchStaffPage({ params }) {
  const { branch, error } = await fetchBranchBySlug(params.slug);
  if (error || !branch) notFound();

  const slug = branch.slug;
  const apiPrefix = `/api/branches/${slug}/staff`;

  return (
    <div className="fb-page-branch">
      <div className="mb-3 flex justify-end text-xs">
        <Link href={`/b/${slug}/login`} className="text-slate-500 hover:text-slate-800">
          Interner Bereich
        </Link>
      </div>
      <BranchAppChrome
        branchSlug={slug}
        branchName={branch.name}
        headerActions={
          <>
            <Link
              href={`/b/${slug}/register`}
              className="min-h-10 shrink-0 rounded-full bg-white px-3 py-2 text-[11px] font-bold text-slate-800 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 sm:min-h-9 sm:px-3.5 sm:py-1.5 sm:text-xs"
            >
              Zur Registrierung
            </Link>
            <Link
              href={`/b/${slug}/order`}
              className="min-h-10 shrink-0 rounded-full bg-white px-3 py-2 text-[11px] font-bold text-slate-800 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 sm:min-h-9 sm:px-3.5 sm:py-1.5 sm:text-xs"
            >
              Zum Frühstück
            </Link>
          </>
        }
      />
      <StaffClient apiPrefix={apiPrefix} />
    </div>
  );
}
