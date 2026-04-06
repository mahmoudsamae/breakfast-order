import Link from "next/link";
import BranchAppChrome from "@/components/BranchAppChrome";
import AdminClient from "@/components/AdminClient";
import { fetchBranchBySlug } from "@/lib/branch-server";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BranchAdminPage({ params }) {
  const { branch, error } = await fetchBranchBySlug(params.slug);
  if (error || !branch) notFound();

  const slug = branch.slug;
  const apiPrefix = `/api/branches/${slug}/admin`;

  return (
    <div className="fb-page-branch">
      <div className="mb-3 flex justify-end text-xs">
        <Link href={`/b/${slug}/login`} className="text-slate-500 hover:text-slate-800">
          Interner Bereich
        </Link>
      </div>
      <BranchAppChrome branchSlug={slug} branchName={branch.name} />
      <AdminClient apiPrefix={apiPrefix} branchLabel={branch.name} />
    </div>
  );
}
