import { notFound } from "next/navigation";
import BranchLandingClient from "@/components/BranchLandingClient";
import { fetchBranchBySlug } from "@/lib/branch-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BranchLandingPage({ params }) {
  const { branch, error } = await fetchBranchBySlug(params.slug);
  if (error || !branch) notFound();

  return (
    <div className="fb-page-order">
      <BranchLandingClient branchSlug={branch.slug} branchName={branch.name} />
    </div>
  );
}
