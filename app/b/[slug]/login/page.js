import { notFound } from "next/navigation";
import { Suspense } from "react";
import BranchLoginForm from "./BranchLoginForm";
import { fetchBranchBySlug } from "@/lib/branch-server";

export const dynamic = "force-dynamic";

export default async function BranchLoginPage({ params }) {
  const { branch, error } = await fetchBranchBySlug(params.slug);
  if (error || !branch) notFound();

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/80 to-white">
      <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Laden…</div>}>
        <BranchLoginForm branchSlug={branch.slug} branchName={branch.name} />
      </Suspense>
    </div>
  );
}
