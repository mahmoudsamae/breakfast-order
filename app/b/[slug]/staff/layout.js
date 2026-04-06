import { redirect } from "next/navigation";
import { getSessionFromCookies, normalizeBranchSlug } from "@/lib/internal-session";

export default async function StaffBranchLayout({ children, params }) {
  const session = await getSessionFromCookies();
  const slug = normalizeBranchSlug(params.slug);
  if (!session || normalizeBranchSlug(session.branchSlug) !== slug) {
    redirect(`/b/${params.slug}/login?next=${encodeURIComponent(`/b/${params.slug}/staff`)}`);
  }
  if (session.role !== "team" && session.role !== "admin") {
    redirect(`/b/${params.slug}/login`);
  }
  return children;
}
